const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

class AuthService {
  generateToken(user) {
    const payload = {
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  }

  async register(userData) {
    const { phoneNumber, name, password, email, role } = userData;

    const existingUser = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existingUser) throw new Error('User exists');

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) throw new Error('Email exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        phoneNumber,
        name,
        email,
        passwordHash,
        role: role || 'ADMIN'
      },
      select: { id: true, phoneNumber: true, name: true, role: true }
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  async login(phoneNumber, password) {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.passwordHash || '');
    if (!isValid) throw new Error('Invalid credentials');

    const token = this.generateToken(user);
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async getUserById(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phoneNumber: true, name: true, role: true, email: true }
    });
  }

  async updateProfile(userId, data) {
    // simplified update
    return prisma.user.update({
      where: { id: userId },
      data: { name: data.name, email: data.email }
    });
  }

  async changePassword(userId, current, newPass) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isValid = await bcrypt.compare(current, user.passwordHash || '');
    if (!isValid) throw new Error('Invalid password');

    const newHash = await bcrypt.hash(newPass, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    return { message: 'Password updated' };
  }
}

module.exports = new AuthService();