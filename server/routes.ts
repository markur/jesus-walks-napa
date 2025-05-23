import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertEventSchema, insertRegistrationSchema, insertWaitlistSchema, insertProductSchema, shippingAddressSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { shippingService } from "./services/shipping";
import multer from "multer";
import fs from "fs";
import path from "path";
import { promisify } from "util";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("Warning: Missing STRIPE_SECRET_KEY. Payment features will be disabled.");
  process.env.STRIPE_SECRET_KEY = '';
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware to check if user is authenticated and is an admin
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};

// Setup multer for file uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const productUploadsDir = path.join(uploadDir, 'products');

// Create upload directories if they don't exist
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (!fs.existsSync(productUploadsDir)) {
    fs.mkdirSync(productUploadsDir);
  }
} catch (err) {
  console.error("Error creating upload directories:", err);
}

// Configure storage
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadsDir);
  },
  filename: function (req, file, cb) {
    // Ensure unique filename with timestamp and preserve extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      return cb(null, false);
    }
    cb(null, true);
  }
});

const writeFileAsync = promisify(fs.writeFile);

export async function registerRoutes(app: Express): Promise<Server> {
  // Special route to create an admin user (for initial setup)
  app.post("/api/create-admin", async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser({
        username,
        password,
        email,
        isAdmin: true
      });
      
      req.session.userId = user.id;
      res.status(201).json({ message: "Admin user created successfully", user });
    } catch (error) {
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    try {
      console.log(`Login attempt for username: ${username}`);
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        console.log(`Login failed: User ${username} not found`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      if (user.password !== password) { // Note: In production, use proper password hashing
        console.log(`Login failed: Password mismatch for ${username}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      console.log(`Login successful for ${username} (User ID: ${user.id}, Admin: ${user.isAdmin})`);
      console.log(`Session ID: ${req.session.id}`);
      res.json({ user });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login", error: error.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    console.log(`Session check: ${req.session.id}, userId: ${req.session?.userId || 'not set'}`);
    
    if (!req.session?.userId) {
      console.log('No userId in session, returning null');
      return res.json(null);
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        console.log(`Found user: ${user.username} (ID: ${user.id}, Admin: ${user.isAdmin})`);
      } else {
        console.log(`No user found with ID: ${req.session.userId}`);
      }
      res.json(user || null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to get user", error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  // Admin routes
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/orders", requireAdmin, async (_req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if this is the first user being created - if so, make them an admin
      const users = await storage.getAllUsers();
      const isFirstUser = users.length === 0;
      
      if (isFirstUser) {
        userData.isAdmin = true;
      }

      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser(userData);
      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Event routes
  app.get("/api/events", async (_req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Registration routes
  app.post("/api/registrations", async (req, res) => {
    try {
      const registrationData = insertRegistrationSchema.parse(req.body);

      const event = await storage.getEvent(registrationData.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const registrations = await storage.getEventRegistrations(registrationData.eventId);
      if (registrations.length >= event.capacity) {
        return res.status(400).json({ message: "Event is at full capacity" });
      }

      const registration = await storage.createRegistration(registrationData);
      res.status(201).json(registration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid registration data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create registration" });
    }
  });

  // Waitlist routes
  app.post("/api/waitlist", async (req, res) => {
    try {
      const waitlistData = insertWaitlistSchema.parse(req.body);

      const isEmailRegistered = await storage.isEmailInWaitlist(waitlistData.email);
      if (isEmailRegistered) {
        return res.status(400).json({ message: "Email already in waitlist" });
      }

      const entry = await storage.addToWaitlist(waitlistData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add to waitlist" });
    }
  });

  // File upload route for product images
  app.post("/api/upload/product-image", requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Return the file URL for client-side use
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const relativePath = `/uploads/products/${req.file.filename}`;
      const imageUrl = `${baseUrl}${relativePath}`;

      res.json({ 
        imageUrl,
        filename: req.file.filename,
        success: true 
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to upload file", error: String(error) });
    }
  });

  // Handle base64 image uploads
  app.post("/api/upload/base64-image", requireAdmin, async (req, res) => {
    try {
      const { imageData, filename = "clipboard-image" } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ message: "No image data provided" });
      }

      // Extract the base64 data - remove data URI prefix
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      
      // Create a unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';base64'));
      const safeName = `${filename.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${uniqueSuffix}.${fileExt || 'png'}`;
      
      // Save the file
      const filePath = path.join(productUploadsDir, safeName);
      await writeFileAsync(filePath, base64Data, 'base64');
      
      // Return the image URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const relativePath = `/uploads/products/${safeName}`;
      const imageUrl = `${baseUrl}${relativePath}`;

      res.json({ 
        imageUrl,
        filename: safeName,
        success: true 
      });
    } catch (error) {
      console.error("Base64 upload error:", error);
      res.status(500).json({ message: "Failed to process image", error: String(error) });
    }
  });

  // Product routes
  app.post("/api/products", requireAdmin, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Add Stripe payment route
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        // Add automatic payment methods
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({
        message: "Error creating payment intent",
        details: error.message
      });
    }
  });

  // Shipping routes
  app.post("/api/shipping/validate-address", async (req, res) => {
    try {
      const address = shippingAddressSchema.parse(req.body);
      const validatedAddress = await shippingService.validateAddress(address);
      res.json(validatedAddress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid address data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to validate address" });
    }
  });

  app.post("/api/shipping/calculate-rates", async (req, res) => {
    try {
      const { fromAddress, toAddress, parcelDetails } = req.body;

      // Validate addresses
      const validFromAddress = shippingAddressSchema.parse(fromAddress);
      const validToAddress = shippingAddressSchema.parse(toAddress);

      const rates = await shippingService.getShippingRates(
        validFromAddress,
        validToAddress,
        parcelDetails
      );

      res.json(rates);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid address data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to calculate shipping rates" });
    }
  });

  // Get address suggestions from Google Places API
  app.get("/api/shipping/address-suggestions", async (req, res) => {
    try {
      const query = req.query.query as string;
      
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }
      
      const suggestions = await shippingService.getAddressSuggestions(query);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      res.status(500).json({ message: "Failed to fetch address suggestions" });
    }
  });

  // Get address details from a place ID
  app.get("/api/shipping/address-details", async (req, res) => {
    try {
      const placeId = req.query.placeId as string;
      
      if (!placeId) {
        return res.status(400).json({ message: "Place ID parameter is required" });
      }
      
      const addressDetails = await shippingService.getAddressDetails(placeId);
      
      if (!addressDetails) {
        return res.status(404).json({ message: "Address details not found" });
      }
      
      res.json(addressDetails);
    } catch (error) {
      console.error("Error fetching address details:", error);
      res.status(500).json({ message: "Failed to fetch address details" });
    }
  });

  // Get city and state from postal code
  app.get("/api/shipping/postal-code-details", async (req, res) => {
    try {
      const code = req.query.code as string;
      
      if (!code) {
        return res.status(400).json({ message: "Postal code parameter is required" });
      }
      
      const details = await shippingService.getPostalCodeDetails(code);
      
      if (!details) {
        return res.status(404).json({ message: "Postal code details not found" });
      }
      
      res.json(details);
    } catch (error) {
      console.error("Error fetching postal code details:", error);
      res.status(500).json({ message: "Failed to fetch postal code details" });
    }
  });


  // Chat routes
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getActiveModelConfigs();
      res.json(models);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const conversations = await storage.getUserConversations(req.session.userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const conversationData = {
        ...req.body,
        userId: req.session.userId,
      };
      const conversation = await storage.createConversation(conversationData);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const conversation = await storage.getConversation(parseInt(req.params.id));
      if (!conversation || conversation.userId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const messages = await storage.getConversationMessages(conversation.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const conversation = await storage.getConversation(parseInt(req.params.id));
      if (!conversation || conversation.userId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: req.body.content,
        tokens: await countTokens(req.body.content),
      });

      // Get model config and generate response
      const modelConfig = await storage.getModelConfig(conversation.modelConfigId);
      if (!modelConfig) {
        throw new Error("Model configuration not found");
      }

      const messages = await storage.getConversationMessages(conversation.id);
      const response = await generateChatResponse(
        messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
        modelConfig
      );

      // Create assistant message
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: response,
        tokens: await countTokens(response),
      });

      res.json({
        userMessage,
        assistantMessage,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to process message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Placeholder functions -  Replace with your actual implementations
async function countTokens(text: string): Promise<number> {
  //  Implementation to count tokens (e.g., using a library)
  return text.split(" ").length; 
}

async function generateChatResponse(messages: any[], modelConfig: any): Promise<string> {
  // Implementation to generate a chat response using the modelConfig
  return "This is a placeholder response.";
}