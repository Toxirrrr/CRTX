import { markStaleOwners, recoverStale } from '../coordinator/registry';

async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'check';
  const chatId = args[1];

  if (action === 'check') {
    const stale = await markStaleOwners();
    if (stale.length > 0) {
      console.log(`\n⚠️ ОБНАРУЖЕНЫ УСТАРЕВШИЕ (STALE) ЗАДАЧИ В CRTX: ${stale.length}`);
      stale.forEach(c => {
        console.log(`  - ChatID: ${c.chatId}`);
        console.log(`    TaskID: ${c.currentTaskId || 'N/A'}`);
        console.log(`    Last Activity: ${c.lastActivity}`);
      });
      console.log(`\nДля продолжения работы (сохранить изменения):`);
      console.log(`  npm run guardian -- resume <ChatID>`);
      console.log(`Для отмены работы (сбросить локи):`);
      console.log(`  npm run guardian -- abort <ChatID>\n`);
      process.exit(1);
    } else {
      console.log(`✅ CRTX Coordinator: Зависших блокировок не найдено.`);
      process.exit(0);
    }
  }

  if (action === 'resume' || action === 'abort') {
    if (!chatId) {
      console.error(`❌ Ошибка: Укажите ChatID. Пример: npm run guardian -- ${action} chat-123`);
      process.exit(1);
    }
    
    try {
      await recoverStale(chatId, action.toUpperCase() as 'RESUME' | 'ABORT');
      console.log(`✅ Локи для чата ${chatId} успешно разрешены (${action.toUpperCase()}).`);
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Ошибка при попытке ${action}:`, err.message);
      process.exit(1);
    }
  }

  console.error(`❌ Неизвестное действие: ${action}. Доступно: check, resume, abort.`);
  process.exit(1);
}

main().catch(err => {
  console.error("❌ Фатальная ошибка CRTX Guardian:", err.message);
  process.exit(1);
});
