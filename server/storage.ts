import { users, events, registrations, waitlist, products, orders, orderItems, modelConfigs, conversations, messages } from "@shared/schema";
import type { User, Event, Registration, Waitlist, Product, Order, OrderItem, InsertUser, InsertEvent, InsertRegistration, InsertWaitlist, InsertProduct, InsertOrder, InsertOrderItem, ModelConfig, InsertModelConfig, Conversation, InsertConversation, Message, InsertMessage } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

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

  // Product operations
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductStock(id: number, quantity: number): Promise<Product>;

  // Order operations
  getOrder(id: number): Promise<Order | undefined>;
  getUserOrders(userId: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order>;

  // Order Item operations
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;

  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllOrders(): Promise<Order[]>;
  updateUserRole(userId: number, isAdmin: boolean): Promise<User>;

  // Session store
  sessionStore: session.Store;

  // Model config operations
  getModelConfig(id: number): Promise<ModelConfig | undefined>;
  getAllModelConfigs(): Promise<ModelConfig[]>;
  createModelConfig(config: InsertModelConfig): Promise<ModelConfig>;
  getActiveModelConfigs(): Promise<ModelConfig[]>;

  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getUserConversations(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;

  // Message operations
  getConversationMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PostgresStore = connectPgSimple(session);
    this.sessionStore = new PostgresStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getRegistration(id: number): Promise<Registration | undefined> {
    const [registration] = await db.select().from(registrations).where(eq(registrations.id, id));
    return registration;
  }

  async createRegistration(registration: InsertRegistration): Promise<Registration> {
    const [newRegistration] = await db.insert(registrations).values(registration).returning();
    return newRegistration;
  }

  async getEventRegistrations(eventId: number): Promise<Registration[]> {
    return await db.select().from(registrations).where(eq(registrations.eventId, eventId));
  }

  async addToWaitlist(email: InsertWaitlist): Promise<Waitlist> {
    const [entry] = await db.insert(waitlist).values(email).returning();
    return entry;
  }

  async isEmailInWaitlist(email: string): Promise<boolean> {
    const [entry] = await db.select().from(waitlist).where(eq(waitlist.email, email));
    return !!entry;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.category, category));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProductStock(id: number, quantity: number): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ stock: quantity })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db.insert(orderItems).values(orderItem).returning();
    return newOrderItem;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async updateUserRole(userId: number, isAdmin: boolean): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ isAdmin })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getModelConfig(id: number): Promise<ModelConfig | undefined> {
    const [config] = await db.select().from(modelConfigs).where(eq(modelConfigs.id, id));
    return config;
  }

  async getAllModelConfigs(): Promise<ModelConfig[]> {
    return await db.select().from(modelConfigs);
  }

  async getActiveModelConfigs(): Promise<ModelConfig[]> {
    return await db.select().from(modelConfigs).where(eq(modelConfigs.active, true));
  }

  async createModelConfig(config: InsertModelConfig): Promise<ModelConfig> {
    const [newConfig] = await db.insert(modelConfigs).values(config).returning();
    return newConfig;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getUserConversations(userId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.userId, userId));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(conversations).values(conversation).returning();
    return newConversation;
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }
}

export const storage = new DatabaseStorage();