const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Models
const User = require('./models/User');
const Message = require('./models/Message');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
      origin: 'http://localhost:3000', // Replace with your frontend URL
      methods: ['GET', 'POST'],
    },
  });


const corsOptions = {
    origin: 'http://localhost:3000', // Allow requests from this origin
    methods: ['GET', 'POST'], // Allowed methods
    credentials: true, // Allow cookies and credentials
};
// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// MongoDB connection
mongoose
  .connect(
    "mongodb+srv://gaganraghav143:8j2iXBurFCFx3igj@cluster0.0zyd8e5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => console.log("Connected to database"))
  .catch(() => console.log("Could not connect to database"));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    username,
    password: hashedPassword,
  });

  await newUser.save();
  res.status(201).send('User registered');
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) return res.status(404).send('User not found');

  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.status(400).send('Invalid credentials');

  const token = jwt.sign({ id: user._id }, 'your_jwt_secret');
  res.json({ token,user });
});

// Get messages
app.get('/messages/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const messages = await Message.find({
    $or: [
      { from: req.user.id, to: userId },
      { from: userId, to: req.user.id }
    ]
  }).sort({ createdAt: 1 });

  res.json(messages);
});

// Define the route to get the current user's details
app.get('/me', authenticateToken, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password'); // Exclude password from response
      if (!user) return res.status(404).send('User not found');
      res.json(user);
    } catch (err) {
      res.status(500).send('Server error');
    }
  });

  app.get('/users', authenticateToken, async (req, res) => {
    try {
      const users = await User.find({ _id: { $ne: req.user.id } }); // Exclude the logged-in user
      res.json(users);
    } catch (err) {
      res.status(500).send('Server error');
    }
  });


  

// Socket.io
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('sendMessage', async (data) => {
    const { from, to, message ,type} = data;

    const newMessage = new Message({
      from,
      to,
      message,
      type,
      createdAt: new Date(),
    });

    await newMessage.save();
    io.emit('receiveMessage', newMessage);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
