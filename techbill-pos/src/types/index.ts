export type Role =
  | 'platform_admin'
  | 'owner'
  | 'cashier'
  | 'inventory_manager'
  | 'accountant'
  | 'technician';

// ─── Permission Keys ──────────────────────────────────────────────────────────

export type Permission =
  | 'pos.read' | 'pos.sell' | 'pos.discount' | 'pos.void' | 'pos.online_sell'
  | 'inventory.read' | 'inventory.write' | 'inventory.delete'
  | 'suppliers.read' | 'suppliers.write'
  | 'customers.read' | 'customers.write'
  | 'returns.read' | 'returns.create' | 'returns.review'
  | 'reports.read' | 'reports.cash_reconciliation'
  | 'users.read' | 'users.manage' | 'users.permissions'
  | 'settings.read' | 'settings.manage'
  | 'audit.read' | 'notifications.read' | 'notifications.manage'
  | 'warranty.read' | 'loyalty.read' | 'loyalty.manage';

export const ALL_PERMISSIONS: Permission[] = [
  'pos.read', 'pos.sell', 'pos.discount', 'pos.void', 'pos.online_sell',
  'inventory.read', 'inventory.write', 'inventory.delete',
  'suppliers.read', 'suppliers.write',
  'customers.read', 'customers.write',
  'returns.read', 'returns.create', 'returns.review',
  'reports.read', 'reports.cash_reconciliation',
  'users.read', 'users.manage', 'users.permissions',
  'settings.read', 'settings.manage',
  'audit.read', 'notifications.read', 'notifications.manage',
  'warranty.read', 'loyalty.read', 'loyalty.manage',
];

// ─── User Types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
  currentPlan?: 'starter' | 'pro' | 'enterprise';
  permissions: string[];
  subdomain?: string | null;
  onlineSellingEnabled?: boolean;
  currentPeriodEnd?: string | null;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
}

// ─── Business Types ──────────────────────────────────────────────────────────

export interface ProductCard {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  sellingPrice: number;
  inStockCount: number;
  soldCount: number;
  returnedCount: number;
}

export interface DashboardData {
  categories: string[];
  lowStock: ProductCard[];
  recentlyAdded: ProductCard[];
  fastSelling: ProductCard[];
  stats: {
    totalProducts: number;
    totalInStock: number;
    totalSold: number;
    totalLowStock: number;
  };
}

export interface ReturnItem {
  id: string;
  saleId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reason: string;
  returnType: 'cash_refund' | 'store_credit' | 'exchange';
  refundAmount: number | null;
  reviewNotes: string | null;
  suspiciousFlag: boolean;
  createdAt: string;
  resolvedAt: string | null;
  inventoryUnit: {
    serialNumber: string;
    product: { name: string; brand: string | null };
  };
  sale: {
    invoiceNumber: string;
    customer: { name: string; phone: string } | null;
  };
  requestedBy: { name: string } | null;
  reviewedBy: { name: string } | null;
}

export interface ShopSettings {
  id: string;
  shopName: string;
  lowStockThreshold: number;
  deadStockDays: number;
  maxDiscountWithoutOtp: number;
  returnFraudWindowDays: number;
  returnFraudCountThreshold: number;
  logoUrl: string | null;
  invoiceFontFamily: string;
  invoicePrimaryColor: string;
  invoiceAccentColor: string;
  invoiceFooterNotes: string | null;
  invoiceWatermarkText: string | null;
  invoiceShowWatermark: boolean;
  tenant?: {
    onlineSellingEnabled: boolean;
  };
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

export interface Reconciliation {
  id: string;
  date: string;
  openingBalance: number;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null;
  notes: string | null;
  createdAt: string;
  submittedBy: { name: string } | null;
  reviewedBy: { name: string } | null;
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  totalSales: number;
  totalRevenue: number;
  avgTransactionValue: number;
}

export interface DeadStockItem {
  unitId: string;
  serialNumber: string;
  productId: string;
  productName: string;
  brand: string | null;
  daysInStock: number;
  receivedAt: string;
}

export interface ProductSpecifications {
  cpu?: string;
  ram?: string;
  storage?: string;
  display?: string;
  battery?: string;
  gpu?: string;
  os?: string;
  color?: string;
  condition?: string;
  [key: string]: string | undefined;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  sellingPrice: number;
  costPrice?: number | null;
  comparePrice?: number | null;
  warrantyMonths: number;
  isActive: boolean;
  shortDescription?: string | null;
  aiSummary?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  specifications?: ProductSpecifications | null;
}

export interface InventoryUnit {
  id: string;
  serialNumber: string;
  status: 'in_stock' | 'sold' | 'return_pending' | 'returned' | 'damaged' | 'repair' | 'reserved';
  purchasePrice: number;
  product: Product;
}

export interface CartItem {
  serialNumber: string;
  productId: string;
  productName: string;
  brand: string | null;
  sellingPrice: number;
}

export interface SaleItem {
  id: string;
  sellingPrice: number;
  inventoryUnit: {
    serialNumber: string;
    product: { id?: string; name: string; brand: string | null; warrantyMonths?: number };
  };
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; phone: string } | null;
  soldBy: { id: string; name: string } | null;
  totalAmount: number;
  discountAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: SaleItem[];
  isOnline?: boolean;
  customerCity?: string | null;
  trackingId?: string | null;
  deliveryCharge?: number;
  advanceAmount?: number;
  codAmount?: number;
  shippingStatus?: 'pending' | 'dispatched' | 'delivered' | 'returned';
  additionalCharges?: number;
  description?: string;
  payoutReceivedAt?: string | null;
  refundLossAmount?: number | null;
}

export interface SalesSummary {
  period: string;
  totalRevenue: number;
  totalGrossProfit: number;
  totalSales: number;
  totalItems: number;
  totalDiscounts: number;
  offlineRevenue: number;
  onlineRevenue: number;
  courierPayouts: number;
  onlineSalesCount: number;
  offlineSalesCount: number;
  pendingOnlineOrders: number;
  byPaymentMethod: { method: string; count: number; revenue: number }[];
  soldProducts: { productId: string; name: string; units: number; revenue: number; onlineUnits?: number }[];
}

export interface LowStockItem {
  productId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  inStockCount: number;
  sellingPrice: number;
}

export interface Notification {
  id: string;
  type: string | null;
  message: string | null;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export interface WsSaleCreatedPayload {
  saleId: string;
  invoiceNumber: string;
  totalAmount: number;
  itemCount: number;
  isOnline: boolean;
  shippingStatus: 'pending' | 'dispatched' | 'delivered' | 'returned';
}

export interface WsStockLowPayload {
  productId: string;
  productName: string;
  stockCount: number;
}

// ─── Tenant Types (Platform Admin) ───────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  maxUsers: number;
  onlineSellingEnabled: boolean;
  appAccessEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  currentPeriodEnd?: string | null;
  ownerEmail?: string;
  _count?: { users: number };
}
