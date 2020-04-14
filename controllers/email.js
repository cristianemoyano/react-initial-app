const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/User');

async function sendEmail(user, url) {
	// Generate test SMTP service account for testing purposes.
	let testAccount = await nodemailer.createTestAccount();

	const dev = process.env.NODE_ENV !== 'production';

	const transporter = nodemailer.createTransport({
	  host: dev ? testAccount.smtp.host : String(process.env.EMAIL_HOST),
	  port: dev ? testAccount.smtp.port : parseInt(process.env.EMAIL_PORT),
	  secure: dev ? testAccount.smtp.secure : JSON.parse(process.env.EMAIL_IS_SECURE) === 1,
	  ignoreTLS: dev ? false : JSON.parse(process.env.EMAIL_IGNORE_TLS) === 1,
	  requireTLS: dev ? false : JSON.parse(process.env.EMAIL_REQUIRE_TLS) === 1,
	  auth: {
	    user: dev ? testAccount.user : String(process.env.EMAIL_LOGIN),
	    pass: dev ? testAccount.pass : String(process.env.EMAIL_PASSWORD)
	  },
	  maxConnections: parseInt(process.env.EMAIL_MAX_CONN),
	  maxMessages: parseInt(process.env.EMAIL_MAX_MSG)
	})

	const emailTemplate = resetPasswordTemplate(user, url)

    const result = await transporter.sendMail(emailTemplate, (err, info) => {
      if (err) {
        console.log(`** Error **`, err)
      } else {
      	console.log(`** Email sent **`, info)
      }
    })
}


const getPasswordResetURL = (host, user, token) => `${host}/${user._id}/${token}`;

const resetPasswordTemplate = (user, url) => {
  const from = process.env.EMAIL_FROM_EMAIL;
  const to = user.email;
  const subject = "Password reset";
  const html = `
  <p>Hey ${user.firstName || user.email},</p>
  <p>We heard that you lost your password. Sorry about that!</p>
  <p>But don’t worry! You can use the following link to reset your password:</p>
  <a href=${url}>${url}</a>
  <p>If you don’t use this link within 1 hour, it will expire.</p>
  <p>Do something outside today! </p>
  <p>–Best!</p>
  `

  return { from, to, subject, html }
}


// `secret` is passwordHash concatenated with user's
// createdAt value, so if someone malicious gets the
// token they still need a timestamp to hack it:
const usePasswordHashToMakeToken = ({
  password: passwordHash,
  _id: userId,
  createdAt
}) => {
  // highlight-start
  const secret = passwordHash + "-" + createdAt;
  const token = jwt.sign({ userId }, secret, {
    expiresIn: 3600 // 1 hour
  })
  // highlight-end
  return token
}


// Sends an email
const sendPasswordResetEmail = async (req, res) => {
  const { email } = req.body;
  let user;
  try {
    user = await User.findOne({ email }).exec()
  } catch (err) {
    res.status(404).json("No user with that email")
  }
  const token = usePasswordHashToMakeToken(user)
  const url = getPasswordResetURL(req.headers.host, user, token)
  // The email submission is a Promise.
  sendEmail(user, url);
  // We accept the request, but no means that the emails was sent successfully.
  res.status(202).json("Sending email.");
}


// Updating the user’s password
const receiveNewPassword = (req, res) => {
  const { userId, token } = req.params;
  const { password } = req.body;
  // highlight-start
  User.findOne({ _id: userId })
    .then(user => {
      const secret = user.password + "-" + user.createdAt;
      const payload = jwt.decode(token, secret);
      if (payload.userId === user.id) {
        bcrypt.genSalt(10, function(err, salt) {
          // Call error-handling middleware:
          if (err) return
          bcrypt.hash(password, salt, function(err, hash) {
            // Call error-handling middleware:
            if (err) return
            User.findOneAndUpdate({ _id: userId }, { password: hash })
              .then(() => res.status(202).json("Password changed accepted"))
              .catch(err => res.status(500).json(err))
          })
        })
      }
    })
    // highlight-end
    .catch(() => {
      res.status(404).json("Invalid user")
    })
}

module.exports.sendEmail = sendEmail;
module.exports.getPasswordResetURL = getPasswordResetURL;
module.exports.resetPasswordTemplate = resetPasswordTemplate;
module.exports.usePasswordHashToMakeToken = usePasswordHashToMakeToken;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
module.exports.receiveNewPassword = receiveNewPassword;