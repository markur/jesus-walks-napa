import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertEventSchema, insertRegistrationSchema, insertWaitlistSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser(userData);
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

  const httpServer = createServer(app);
  return httpServer;
}
