"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
const BCRYPT_ROUNDS = 10;
async function main() {
    console.log('Seeding DHA Tenant and users into the database...');
    let tenant = await prisma.tenant.findUnique({
        where: { slug: 'electrotrack-dha' }
    });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'ElectroTrack DHA',
                slug: 'electrotrack-dha',
                status: 'active',
                plan: 'trial',
                appAccessEnabled: true,
                maxUsers: 5
            }
        });
        console.log(`✅ Created Tenant: ${tenant.name} (${tenant.slug})`);
    }
    else {
        tenant = await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                status: 'active',
                appAccessEnabled: true
            }
        });
        console.log(`ℹ️ Tenant already exists, updated access: ${tenant.name}`);
    }
    const ownerEmail = 'dha_owner@electroshop.pk';
    const ownerPasswordHash = await bcrypt.hash('Owner@123', BCRYPT_ROUNDS);
    let owner = await prisma.user.findUnique({
        where: { email: ownerEmail }
    });
    if (!owner) {
        owner = await prisma.user.create({
            data: {
                email: ownerEmail,
                name: 'DHA Owner',
                passwordHash: ownerPasswordHash,
                role: 'owner',
                isActive: true,
                tenantId: tenant.id
            }
        });
        console.log(`✅ Created User: ${owner.name} (${owner.email})`);
    }
    else {
        owner = await prisma.user.update({
            where: { id: owner.id },
            data: {
                passwordHash: ownerPasswordHash,
                role: 'owner',
                isActive: true,
                tenantId: tenant.id
            }
        });
        console.log(`ℹ️ User already exists, updated password and role: ${owner.email}`);
    }
    const cashierEmail = 'dha_cashier@electroshop.pk';
    const cashierPasswordHash = await bcrypt.hash('Cashier@123', BCRYPT_ROUNDS);
    let cashier = await prisma.user.findUnique({
        where: { email: cashierEmail }
    });
    if (!cashier) {
        cashier = await prisma.user.create({
            data: {
                email: cashierEmail,
                name: 'DHA Cashier',
                passwordHash: cashierPasswordHash,
                role: 'cashier',
                isActive: true,
                tenantId: tenant.id
            }
        });
        console.log(`✅ Created User: ${cashier.name} (${cashier.email})`);
    }
    else {
        cashier = await prisma.user.update({
            where: { id: cashier.id },
            data: {
                passwordHash: cashierPasswordHash,
                role: 'cashier',
                isActive: true,
                tenantId: tenant.id
            }
        });
        console.log(`ℹ️ User already exists, updated password and role: ${cashier.email}`);
    }
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=create_dha.js.map