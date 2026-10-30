import { createApp } from './app.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const app=createApp({root:resolve(root,'public'),dbPath:resolve(process.env.DATA_DIR||resolve(root,'data'),'orders.sqlite'),origin:process.env.APP_ORIGIN||'http://localhost:3000',clientId:process.env.PAYPAL_CLIENT_ID||'',secret:process.env.PAYPAL_CLIENT_SECRET||'',environment:process.env.PAYPAL_ENV||'sandbox',webhookId:process.env.PAYPAL_WEBHOOK_ID||'',liveConfirmed:process.env.LIVE_PAYMENTS_CONFIRMED==='yes',adminPassword:process.env.ADMIN_PASSWORD||'',resendKey:process.env.RESEND_API_KEY||'',mailFrom:process.env.MAIL_FROM||'',storeEmail:process.env.STORE_NOTIFICATION_EMAIL||'',allowSandboxMail:process.env.MAIL_ALLOW_SANDBOX==='yes'});
app.server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Tienda iniciada; pagos '+(app.ready?'configurados':'pendientes de configuración')));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>app.server.close(()=>process.exit(0)));
