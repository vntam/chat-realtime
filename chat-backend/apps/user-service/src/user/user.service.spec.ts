import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserRole } from '../role/user-role.entity';
import { UserGroup } from '../group/user-group.entity';

describe('UserService', () => {
  let service: UsersService;
  const repoMock = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repoMock,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: repoMock,
        },
        {
          provide: getRepositoryToken(UserGroup),
          useValue: repoMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
