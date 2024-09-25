
const express = require('express');

const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const port = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Token verification middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};

// MongoDB client
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // Collections
    const trainnerCollection = client.db('theFitness').collection('trainner');
    const usersCollection = client.db('theFitness').collection('users');
    const ClassCollection = client.db('theFitness').collection('class');
    const appliedTrainerCollection = client.db('theFitness').collection('appliedTrainer');

    // Verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== 'admin') {
        return res.status(401).send({ message: 'Forbidden Access' });
      }
      next();
    };
    app.get('/users-email' , async (req, res) => {
      const email = req.query.email; // Get email from the route parameter
      console.log("email" , email)
      // const result = await usersCollection.findOne(email );
      // res.send(result);
      // if (!email) {
      //   return res.status(400).send({ message: 'Email is required' });
      // }
      // try {
      //   const result = await usersCollection.findOne({ email });
      //   if (!result) {
      //     return res.status(404).send({ message: 'User not found' });
      //   }
      //   res.send(result);
      // } catch (error) {
      //   res.status(500).send({ message: 'Error fetching user', error });
      // }
    });
    // Authentication-related APIs
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Logout route
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true });
        console.log('Logout successful');
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Get all users
    app.get('/user', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Get all trainers
    app.get('/trainners', async (req, res) => {
      const result = await trainnerCollection.find().toArray();
      res.send(result);
    });

    // Add a trainer
    app.post('/trainners', async (req, res) => {
      const formData = req.body;
      const result = await trainnerCollection.insertOne(formData);
      res.send(result);
    });

    // Save a trainer in the users collection
    app.post('/users', async (req, res) => {
      const roomData = req.body;
      const result = await usersCollection.insertOne(roomData);
      res.send(result);
    });

    // Save a class in the class collection (Admin only)
    app.post('/class', verifyToken, verifyAdmin, async (req, res) => {
      const classData = req.body;
      const result = await ClassCollection.insertOne(classData);
      res.send(result);
    });

    // Get paginated classes
    app.get('/class', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await ClassCollection.find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // Get the class count
    app.get('/classCount', async (req, res) => {
      const count = await ClassCollection.countDocuments();
      res.send({ count });
    });

    // Get single trainer details by ID
    app.get('/trainnerDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await trainnerCollection.findOne(query);
      res.send(result);
    });

    // Get single user  details by ID
    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      console.log("id", id)
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // Get trainer details for the payment page by ID
    app.get('/paymentPage/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await trainnerCollection.findOne(query);
      res.send(result);
    });

    // Get a user's info by email
   


    // Get users with status 'Requested'
    app.get('/requested-users',  async (req, res) => {
      try {
        const result = await usersCollection.find({ status: 'Requested' }).toArray();
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error fetching data' });
      }
    });

    // Confirm a trainer application
    app.put('/user', async (req, res) => {
      const user = req.body;
      // console.log("User", user)

      const query = { email: user?.email };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user.status === 'requested') {
          const result = await usersCollection.updateOne(query, { $set: { status: user?.status } });
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }
      const options = { upsert: true };
      const updateDoc = { $set: { ...user, timestamp: Date.now() } };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Get all users from the database
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Ping MongoDB to confirm successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (error) {
    console.error('Error during MongoDB connection or route setup:', error);
  }
}

// Start the server
run().catch(console.dir).then(() => {
  app.listen(port, () => {
    console.log(`The Fitness is running on port ${port}`);
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello from The Fitness Server..');
});
