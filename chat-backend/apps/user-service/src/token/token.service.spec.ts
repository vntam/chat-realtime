import { Test, TestingModule } from '@nestjs/testing';
import { TokensService } from './token.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Token } from './token.entity';
import { JwtService } from '@nestjs/jwt';

describe('TokensService', () => {
  let service: TokensService;
  const repoMock = {};
  const jwtMock = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: getRepositoryToken(Token),
          useValue: repoMock,
        },
        {
          provide: JwtService,
          useValue: jwtMock,
        },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
