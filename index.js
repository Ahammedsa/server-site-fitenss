const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log("token", token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {
    // Collection
    const trainnerCollection = client.db('theFitness').collection('trainner')
    const usersCollection = client.db('theFitness').collection('users')
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      console.log('I need a new jwt', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // get all  trainners from server 
    app.get('/trainners', async (req, res) => {
      const result = await trainnerCollection.find().toArray()
      res.send(result)
    })
    // B.1 save a trainner in db 
    app.post('/users', async (req, res) => {
      const roomData = req.body
      const result = await usersCollection.insertOne(roomData)
      res.send(result);
    })

    // A.2 Get single trainner details  from data from db using _id
    app.get("/trainnerDetails/:id", async (req, res) => {
      const id = req.params.id;
      console.log('trainner id ', id)
      const query = { _id: new ObjectId(id) }
      const result = await trainnerCollection.findOne(query);
      console.log("result", result)
      res.send(result)
    })

    // A.3 Get single trainner details  from data from db using _id  for payment page  
    app.get("/paymentPage/:id", async (req, res) => {
      const id = req.params.id;
      console.log('trainner id ', id)
      const query = { _id: new ObjectId(id) }
      const result = await trainnerCollection.findOne(query);
      console.log("result", result)
      res.send(result)
    })

    // get a user info by email from db 
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })
    
    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user.status === "requested") {
          // If existing user tries to change their role
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status }
          });
          // If existing user logs in again
          return res.send(result);
        } else {
          // If the user exists but no status change is needed, return the existing user
          return res.send(isExist);
        }
      }
      // If user does not exist, save the user for the first time
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const isExist = await usersCollection.findOne(query)
      console.log('User found?----->', isExist)
      if (isExist) return res.send(isExist)
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user },
        },
        options
      )
      res.send(result)
    })
    // Get all usersa from db 
    app.get('/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from The Fitness Server..')
})

app.listen(port, () => {
  console.log(`The Fitness is running on port ${port}`)
})
