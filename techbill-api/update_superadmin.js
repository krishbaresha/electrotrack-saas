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
    const email = 'superadmin@electrotrack.pk';
    const newPassword = 'SuperAdmin@123';
    const user = await prisma.user.findUnique({
        where: { email }
    });
    if (user) {
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                isActive: true
            }
        });
        console.log(`✅ Successfully updated password for ${email} to "${newPassword}"`);
    }
    else {
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        const newUser = await prisma.user.create({
            data: {
                email,
                name: 'Super Admin',
                passwordHash,
                role: 'platform_admin',
                isActive: true
            }
        });
        console.log(`✅ Created Super Admin user ${email} with password "${newPassword}"`);
    }
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=update_superadmin.js.map