const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { AppError } = require('../core/AppError');

class AuthService {
  constructor(repository) {
    this.repository = repository;
  }

  async login(credentials) {
    const user = await this.repository.findUserByUsername(credentials.username);
    const valid = user ? await bcrypt.compare(credentials.password, user.PasswordHash) : false;
    if (!valid) throw new AppError(401, 'Credenciales inválidas');

    const publicUser = { id: user.UserID, username: user.Username, role: user.Role };
    const token = jwt.sign(publicUser, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    return { token, user: publicUser };
  }

  async bootstrapAdmin({ username, password, setupKey }) {
    if (env.adminSetupKey && setupKey !== env.adminSetupKey) {
      throw new AppError(403, 'La clave de configuración no es válida');
    }
    if (await this.repository.hasUsers()) {
      throw new AppError(409, 'El administrador inicial ya fue creado');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.repository.createUser({ username, passwordHash });
  }
}

module.exports = { AuthService };
