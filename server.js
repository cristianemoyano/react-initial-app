// As early as possible in your application, require and configure dotenv.
require('dotenv').config()

const {createServer} = require('http');
const express = require('express');
const connectDB = require('./config/db');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');

const app = express();
// NODE_ENV
const dev = app.get('env') !== 'production';

const normalizePort = port => parseInt(port, 10);
const PORT = normalizePort(process.env.PORT || 5000);

// Connect Database
connectDB();

if (!dev) {
	// Non-dev Middlewares
	// Remove X-Powered-By header
	app.disable('x-powered-by');
	// Compression: Node.js compression middleware.
	app.use(compression());
	// Helmet: Express.js security with HTTP headers. 
	app.use(helmet());
	// Morgan: HTTP request logger middleware for node.js
	app.use(morgan('common'));

}
if (dev) {
	// Dev Middlewares
	app.use(morgan('dev'));
}

// Statics
app.use(express.static(path.resolve(__dirname, 'build')));

//Routes
app.get('*', (req, res) =>{
	res.sendFile(path.resolve(__dirname, 'build', 'index.html'))
})

// Define Routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/profile', require('./routes/api/profile'));


const server = createServer(app);

// Run server with express: node server.js
server.listen(PORT, err => {
	if (err) throw err;
	console.log(`Server started.`);
});
