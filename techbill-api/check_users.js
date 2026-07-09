"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const emails = [
        'superadmin@electrotrack.pk',
        'owner@electroshop.pk',
        'cashier@electroshop.pk',
        'tech@electroshop.pk',
        'dha_owner@electroshop.pk',
        'dha_cashier@electroshop.pk',
        'moizghouri@owner.com'
    ];
    console.log('Checking database status for specified accounts...');
    for (const email of emails) {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                tenant: true
            }
        });
        if (user) {
            console.log(`\n📧 Email: ${email}`);
            console.log(`   - Name: ${user.name}`);
            console.log(`   - Role: ${user.role}`);
            console.log(`   - Active Status: ${user.isActive ? 'Active' : 'Inactive'}`);
            if (user.tenant) {
                console.log(`   - Tenant Name: ${user.tenant.name}`);
                console.log(`   - Tenant Slug: ${user.tenant.slug}`);
                console.log(`   - Tenant Mobile App Access: ${user.tenant.appAccessEnabled ? 'ENABLED' : 'DISABLED'}`);
                console.log(`   - Tenant Status: ${user.tenant.status}`);
            }
            else {
                console.log(`   - Tenant: None (Global Super Admin)`);
            }
        }
        else {
            console.log(`\n❌ Email: ${email} -> NOT FOUND in database`);
        }
    }
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=check_users.js.map