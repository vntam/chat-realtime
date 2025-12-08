import { DataSource } from 'typeorm';
import { typeOrmDataSourceOptions } from './src/database/typeorm.config';

export default new DataSource(typeOrmDataSourceOptions);

