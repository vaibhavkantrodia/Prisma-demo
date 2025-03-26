import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './strategy/constant/constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async createUser(createAuthDto: CreateAuthDto) {
    try {
      const { name, email, password } = createAuthDto;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = await this.prisma.user.create({
        data: { name, email, password: hashedPassword },
      });

      return {
        statusCode: 201,
        message: 'User created successfully',
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        throw new BadRequestException('Invalid credentials');
      }

      const payload = { email: user.email };

      const accessToken = await this.jwtService.sign(payload, { secret: jwtConstants.secret });

      const newUser = { ...user, accessToken }

      return {
        statusCode: 200,
        message: 'User logged in successfully',
        data: newUser,
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: forgotPasswordDto.email,
        },
      });

      if (!user) {
        throw new HttpException('email not found', HttpStatus.BAD_REQUEST);
      }

      const payload = {
        id: user.id,
        email: user.email,
      };

      const token = this.jwtService.sign(payload, jwtConstants);

      const resetPasswordLink = `http://localhost:3000/password-reset/${token}`;

      return {
        statusCode: HttpStatus.OK,
        message: 'Reset password link sent to email',
        link: resetPasswordLink,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    try {
      const decodeToken = this.jwtService.verify(resetPasswordDto.token, jwtConstants);

      const user = await this.prisma.user.findUnique({
        where: {
          email: decodeToken.email,
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(resetPasswordDto.password, salt);

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: hashedPassword,
        },
      });

      return {
        statusCode: HttpStatus.OK,
        message: 'Password reset successfully',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
