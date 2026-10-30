import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
const db=new DatabaseSync(resolve(process.env.DATA_DIR||'data','orders.sqlite'),{readOnly:true});
const rows=db.prepare('SELECT ref,status,paypal_id,capture_id,created,receipt,contact FROM orders ORDER BY created DESC LIMIT 100').all();
console.log(JSON.stringify(rows.map(r=>({...r,receipt:JSON.parse(r.receipt),contact:JSON.parse(r.contact)})),null,2));db.close();
