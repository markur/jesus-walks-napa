import { users, events, registrations, waitlist } from "@shared/schema";
import type { User, Event, Registration, Waitlist, InsertUser, InsertEvent, InsertRegistration, InsertWaitlist } from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Event operations
  getEvent(id: number): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  
  // Registration operations
  getRegistration(id: number): Promise<Registration | undefined>;
  createRegistration(registration: InsertRegistration): Promise<Registration>;
  getEventRegistrations(eventId: number): Promise<Registration[]>;
  
  // Waitlist operations
  addToWaitlist(email: InsertWaitlist): Promise<Waitlist>;
  isEmailInWaitlist(email: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private registrations: Map<number, Registration>;
  private waitlist: Map<number, Waitlist>;
  private currentIds: {
    users: number;
    events: number;
    registrations: number;
    waitlist: number;
  };

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.registrations = new Map();
    this.waitlist = new Map();
    this.currentIds = {
      users: 1,
      events: 1,
      registrations: 1,
      waitlist: 1,
    };
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.users++;
    const user: User = { 
      ...insertUser, 
      id, 
      isAdmin: false,
      isVerified: false 
    };
    this.users.set(id, user);
    return user;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values());
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const id = this.currentIds.events++;
    const newEvent: Event = { ...event, id };
    this.events.set(id, newEvent);
    return newEvent;
  }

  async getRegistration(id: number): Promise<Registration | undefined> {
    return this.registrations.get(id);
  }

  async createRegistration(registration: InsertRegistration): Promise<Registration> {
    const id = this.currentIds.registrations++;
    const newRegistration: Registration = { 
      ...registration, 
      id,
      createdAt: new Date()
    };
    this.registrations.set(id, newRegistration);
    return newRegistration;
  }

  async getEventRegistrations(eventId: number): Promise<Registration[]> {
    return Array.from(this.registrations.values()).filter(
      (reg) => reg.eventId === eventId,
    );
  }

  async addToWaitlist(email: InsertWaitlist): Promise<Waitlist> {
    const id = this.currentIds.waitlist++;
    const entry: Waitlist = { 
      ...email, 
      id,
      createdAt: new Date()
    };
    this.waitlist.set(id, entry);
    return entry;
  }

  async isEmailInWaitlist(email: string): Promise<boolean> {
    return Array.from(this.waitlist.values()).some(
      (entry) => entry.email === email,
    );
  }
}

export const storage = new MemStorage();
