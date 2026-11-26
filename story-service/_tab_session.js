const fs = require('fs');
const must = (s, a, l) => { if (!s.includes(a)) throw new Error('anchor: ' + l); return s; };

// DTOs: refresh token in the body; access response carries it.
{
  const f = 'src/auth/dto/auth.dto.ts';
  let s = fs.readFileSync(f, 'utf8');
  s = must(s, 'export class AuthTokensDto {', 'AuthTokensDto');
  s = s.replace('export class AuthTokensDto {', `export class RefreshTokenDto {
  @ApiProperty({ required: false, description: 'Refresh token kept in this tab' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'Refresh token for this tab only (kept in sessionStorage)' })
  refreshToken: string;
`);
  s = s.replace("import { IsEmail, IsString, Length, MaxLength } from 'class-validator';", "import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';");
  fs.writeFileSync(f, s);
}

// Controller: body token, no cookie.
{
  const f = 'src/auth/auth.controller.ts';
  let s = fs.readFileSync(f, 'utf8');
  s = must(s, '    const issued = await this.auth.login(dto);\n    this.setRefreshCookie(res, issued.refreshToken);\n    return issued.tokens;', 'login body');
  s = s.replace('    const issued = await this.auth.login(dto);\n    this.setRefreshCookie(res, issued.refreshToken);\n    return issued.tokens;', '    const issued = await this.auth.login(dto);\n    return { ...issued.tokens, refreshToken: issued.refreshToken };');
  s = must(s, "  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthTokensDto> {\n    const issued = await this.auth.refresh(req.cookies?.[this.cfg.jwt.refreshCookieName]);\n    this.setRefreshCookie(res, issued.refreshToken);\n    return issued.tokens;", 'refresh body');
  s = s.replace("  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthTokensDto> {\n    const issued = await this.auth.refresh(req.cookies?.[this.cfg.jwt.refreshCookieName]);\n    this.setRefreshCookie(res, issued.refreshToken);\n    return issued.tokens;", "  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {\n    const issued = await this.auth.refresh(dto.refreshToken);\n    return { ...issued.tokens, refreshToken: issued.refreshToken };");
  s = must(s, "  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {\n    await this.auth.logout(req.cookies?.[this.cfg.jwt.refreshCookieName]);\n    res.clearCookie(this.cfg.jwt.refreshCookieName, this.cookieOptions());\n    return { loggedOut: true };", 'logout');
  s = s.replace("  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {\n    await this.auth.logout(req.cookies?.[this.cfg.jwt.refreshCookieName]);\n    res.clearCookie(this.cfg.jwt.refreshCookieName, this.cookieOptions());\n    return { loggedOut: true };", "  async logout(@Body() dto: RefreshTokenDto) {\n    await this.auth.logout(dto.refreshToken);\n    return { loggedOut: true };");
  s = s.replace("  TokenDto,\n} from './dto/auth.dto';", "  RefreshTokenDto,\n  TokenDto,\n} from './dto/auth.dto';");
  // Remove the cookie helpers, which are no longer used.
  const helpersStart = s.indexOf('  // ---------- cookie helpers ----------');
  if (helpersStart >= 0) {
    const end = s.lastIndexOf('}');
    s = s.slice(0, helpersStart).replace(/\n\s*$/, '\n') + '}\n';
  }
  s = s.replace("import type { Request, Response } from 'express';\n", '');
  s = s.replace("import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';", "import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';");
  fs.writeFileSync(f, s);
}
console.log('backend uses body token');
