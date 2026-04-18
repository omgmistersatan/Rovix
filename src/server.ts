import { app } from './app.js';
import { env } from './config/env.js';
import { seedDefaults } from './services/store.service.js';

async function bootstrap() {
  await seedDefaults();
  app.listen(env.port, () => {
    console.log(`Rovix backend rodando em http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar aplicação:', error);
  process.exit(1);
});
