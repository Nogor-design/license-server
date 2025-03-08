const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 80;

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB (adjust connection string as needed)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/licensing', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error', err);
});

// Define a License schema (simplified)
const licenseSchema = new mongoose.Schema({
  licenseKey: { type: String, unique: true, required: true },
  userEmail: { type: String, required: true },
  product: { type: String, required: true },
  purchaseType: { type: String, default: 'one-time' }, // or 'subscription'
  status: { type: String, default: 'active' }, // 'active', 'expired', 'revoked'
  machineId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }
});
const License = mongoose.model('License', licenseSchema);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('License Server is running!');
});

// Create license (called by Shopify/Wix webhook)
app.post('/api/licenses', async (req, res) => {
  try {
    const {
      licenseKey,
      userEmail,
      product,
      purchaseType,
      expiresAt
    } = req.body;

    // Generate a licenseKey if not provided
    const newKey = licenseKey || Math.random().toString(36).substring(2, 10) + 
      Math.random().toString(36).substring(2, 10);

    const license = new License({
      licenseKey: newKey,
      userEmail,
      product,
      purchaseType,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    await license.save();

    return res.json({
      success: true,
      licenseKey: license.licenseKey
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify license
app.post('/api/license/verify', async (req, res) => {
  try {
    const { licenseKey, machineId, product } = req.body;

    const license = await License.findOne({ licenseKey, product });
    if (!license) {
      return res.json({ valid: false, reason: 'license_not_found' });
    }

    // Check status
    if (license.status !== 'active') {
      return res.json({ valid: false, reason: 'license_inactive' });
    }

    // If subscription, check expiry
    if (license.purchaseType === 'subscription' && license.expiresAt) {
      if (new Date() > license.expiresAt) {
        // Mark as expired
        license.status = 'expired';
        await license.save();
        return res.json({ valid: false, reason: 'license_expired' });
      }
    }

    // Check machine binding
    if (!license.machineId) {
      // First activation
      license.machineId = machineId;
      await license.save();
    } else {
      if (license.machineId !== machineId) {
        return res.json({ valid: false, reason: 'machine_mismatch' });
      }
    }

    return res.json({ valid: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`License server running on port ${port}`);
});
