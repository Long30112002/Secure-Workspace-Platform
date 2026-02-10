import { Module, Global } from '@nestjs/common';
import { QueryParserService } from './query-parser.service';

@Global()  // Có thể global để dùng mọi nơi
@Module({
    providers: [QueryParserService],
    exports: [QueryParserService],
})
export class QueryParserModule { }