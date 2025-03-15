import { users, events, registrations, waitlist, products, orders, orderItems } from "@shared/schema";
import type { User, Event, Registration, Waitlist, Product, Order, OrderItem, InsertUser, InsertEvent, InsertRegistration, InsertWaitlist, InsertProduct, InsertOrder, InsertOrderItem } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private registrations: Map<number, Registration>;
  private waitlist: Map<number, Waitlist>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private currentIds: {
    users: number;
    events: number;
    registrations: number;
    waitlist: number;
    products: number;
    orders: number;
    orderItems: number;
  };

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.registrations = new Map();
    this.waitlist = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.currentIds = {
      users: 1,
      events: 1,
      registrations: 1,
      waitlist: 1,
      products: 1,
      orders: 1,
      orderItems: 1,
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

  // New e-commerce methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.category === category
    );
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentIds.products++;
    const newProduct: Product = { 
      ...product, 
      id,
      createdAt: new Date()
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProductStock(id: number, quantity: number): Promise<Product> {
    const product = await this.getProduct(id);
    if (!product) {
      throw new Error('Product not found');
    }
    const updatedProduct: Product = {
      ...product,
      stock: quantity
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.userId === userId
    );
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.currentIds.orders++;
    const now = new Date();
    const newOrder: Order = {
      ...order,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const order = await this.getOrder(id);
    if (!order) {
      throw new Error('Order not found');
    }
    const updatedOrder: Order = {
      ...order,
      status,
      updatedAt: new Date()
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === orderId
    );
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.currentIds.orderItems++;
    const newOrderItem: OrderItem = {
      ...orderItem,
      id
    };
    this.orderItems.set(id, newOrderItem);
    return newOrderItem;
  }
}

export const storage = new MemStorage();