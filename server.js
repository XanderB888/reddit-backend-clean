const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://reddit-clone-rust-eta.vercel.app',
    'https://reddit-clone-ioe-vercel.app'
  ]
}));

app.use(express.json());

// Simple access token management
let accessToken = null;

async function getAccessToken() {
  if (accessToken) return accessToken;
  
  try {
    const auth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': process.env.REDDIT_USER_AGENT || 'ReddeX/1.0.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    accessToken = response.data.access_token;
    
    // Clear token after 50 minutes
    setTimeout(() => { accessToken = null; }, 50 * 60 * 1000);
    
    return accessToken;
  } catch (error) {
    console.error('Token error:', error.message);
    throw error;
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Reddit Clone API is running!', status: 'healthy' });
});

// Get posts
app.get('/api/posts/:subreddit?', async (req, res) => {
  try {
    const subreddit = req.params.subreddit || 'popular';
    const token = await getAccessToken();

    const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/hot`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': process.env.REDDIT_USER_AGENT || 'ReddeX/1.0.0'
      },
      params: { limit: 25 }
    });

    const posts = response.data.data.children.map(child => ({
      id: child.data.id,
      title: child.data.title,
      author: child.data.author,
      score: child.data.score,
      num_comments: child.data.num_comments,
      created_utc: child.data.created_utc,
      url: child.data.url,
      selftext: child.data.selftext,
      subreddit: child.data.subreddit,
      permalink: child.data.permalink,
      thumbnail: child.data.thumbnail !== 'self' ? child.data.thumbnail : null
    }));

    res.json({ posts, subreddit });
  } catch (error) {
    console.error('Posts error:', error.message);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Search posts
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const token = await getAccessToken();

    const response = await axios.get('https://oauth.reddit.com/search', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': process.env.REDDIT_USER_AGENT || 'ReddeX/1.0.0'
      },
      params: { q: query, type: 'link', limit: 25 }
    });

    const posts = response.data.data.children.map(child => ({
      id: child.data.id,
      title: child.data.title,
      author: child.data.author,
      score: child.data.score,
      num_comments: child.data.num_comments,
      created_utc: child.data.created_utc,
      url: child.data.url,
      selftext: child.data.selftext,
      subreddit: child.data.subreddit,
      permalink: child.data.permalink,
      thumbnail: child.data.thumbnail !== 'self' ? child.data.thumbnail : null
    }));

    res.json({ posts, query });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Failed to search posts' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});