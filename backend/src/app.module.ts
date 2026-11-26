import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AuthModule } from "./auth/auth.module"
import { UsersModule } from "./users/users.module"
import { CommonModule } from "./common/common.module"
import { PrismaModule } from "./prisma/prisma.module"
import { SettingsModule } from "./settings/settings.module"
import { PasswordPolicyModule } from "./password-policy/password-policy.module"
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver, I18nJsonLoader } from 'nestjs-i18n'
import * as path from 'path'
import { DepartmentsModule } from './departments/departments.module'
import { FleetModule } from './fleet/fleet.module'
import { UploadModule } from './upload/upload.module'
import { MaintenanceApprovalModule } from './maintenance-approval/maintenance-approval.module'


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',      // prefer env file located in backend/.env
        '../.env',   // fallback to monorepo root .env
      ],
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loader: I18nJsonLoader,
      loaderOptions: {
        path: path.join(__dirname, 'i18n'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang', 'locale', 'l'] },
        new HeaderResolver(['x-lang', 'x-locale']),
        AcceptLanguageResolver,
      ],
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    DepartmentsModule,
    FleetModule,
    MaintenanceApprovalModule,
    UploadModule,
    PasswordPolicyModule,


  ],
})
export class AppModule {}
