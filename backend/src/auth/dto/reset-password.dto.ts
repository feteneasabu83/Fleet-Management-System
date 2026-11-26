import { IsString, MinLength } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class ResetPasswordDto {
  @ApiProperty({ description: "Password reset token from email link" })
  @IsString()
  token: string

  @ApiProperty({ example: "NewP@ssw0rd123", minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string
}
