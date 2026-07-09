"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const users = await prisma.user.findMany({
        include: {
            tenant: true
        }
    });
    console.log(`Total users in database: ${users.length}`);
    users.forEach(u => {
        console.log(`- Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | Tenant: ${u.tenant?.name ?? 'Global'}`);
    });
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=list_users.js.map