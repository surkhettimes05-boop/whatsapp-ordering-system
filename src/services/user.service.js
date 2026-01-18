const prisma = require('../config/database');

class UserService {
    /**
     * Find user by phone number or create if not exists
     * @param {string} phoneNumber - WhatsApp number without 'whatsapp:'
     * @param {string} profileName - Name from WhatsApp profile
     */
    async findOrCreateUser(phoneNumber, profileName) {
        let user = await prisma.user.findUnique({
            where: { phoneNumber: phoneNumber }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    phoneNumber: phoneNumber,
                    name: profileName || 'WhatsApp User',
                    whatsappId: `whatsapp:${phoneNumber}`,
                    role: 'RETAILER',
                    conversationState: null
                }
            });
            console.log(`✅ New user created: ${phoneNumber}`);
        }

        return user;
    }

    /**
     * Update user details
     */
    async updateUser(userId, data) {
        return await prisma.user.update({
            where: { id: userId },
            data
        });
    }
}

module.exports = new UserService();
