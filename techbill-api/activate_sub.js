"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const result = await prisma.tenant.updateMany({
        data: {
            appAccessEnabled: true,
            status: 'active'
        }
    });
    console.log('Successfully activated app access subscription for all tenants:', result);
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=activate_sub.js.map