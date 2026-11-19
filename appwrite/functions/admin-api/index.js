import {Client,Databases,Users,ID,Query} from 'node-appwrite';
const parseBody=req=>req.bodyJson??(typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body??{});
export default async({req,res,error})=>{
 try{
  if(req.method!=='POST')return res.json({ok:false,error:'Method not allowed'},405);
  const uid=req.headers['x-appwrite-user-id'];if(!uid)return res.json({ok:false,error:'請先登入'},401);
  const client=new Client().setEndpoint(process.env.APPWRITE_ENDPOINT||process.env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID||process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY||req.headers['x-appwrite-key']);
  const users=new Users(client),u=await users.get(uid);
  if(!u.labels?.includes('admin')&&!u.labels?.includes('shop-admin'))return res.json({ok:false,error:'沒有管理權限'},403);
  const db=new Databases(client),database=process.env.APPWRITE_DATABASE_ID||'line_order',cats=process.env.APPWRITE_CATEGORIES_COLLECTION_ID||'categories',products=process.env.APPWRITE_PRODUCTS_COLLECTION_ID||'products',orders=process.env.APPWRITE_ORDERS_COLLECTION_ID||'orders';
  const b=parseBody(req);let result;
  if(b.action==='list'){
   const[c,p,o]=await Promise.all([db.listDocuments(database,cats,[Query.limit(100)]),db.listDocuments(database,products,[Query.limit(100)]),db.listDocuments(database,orders,[Query.orderDesc('$createdAt'),Query.limit(100)])]);
   return res.json({ok:true,categories:c.documents,products:p.documents,orders:o.documents});
  }
  if(b.action==='status'){
   const old=await db.getDocument(database,orders,b.id);
   const allowed={pending:['confirmed','cancelled'],confirmed:['shipped','cancelled'],preparing:['shipped','cancelled']};
   if(!allowed[old.status]?.includes(b.status))return res.json({ok:false,error:'此訂單狀態不允許這項操作，請重新整理'},400);
   const fields={status:b.status};if(typeof b.adminNote==='string')fields.admin_note=b.adminNote.slice(0,1000);
   result=await db.updateDocument(database,orders,b.id,fields);
  }else if(b.action==='note'){
   if(typeof b.adminNote!=='string'||b.adminNote.length>1000)throw Error('備註過長');
   result=await db.updateDocument(database,orders,b.id,{admin_note:b.adminNote});
  }else if(b.action==='addCategory'){
   if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80)throw Error('分類名稱不正確');
   result=await db.createDocument(database,cats,ID.unique(),{name:b.name.trim(),is_active:true,sort_order:0});
  }else if(b.action==='renameCategory'){
   if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80)throw Error('分類名稱不正確');
   result=await db.updateDocument(database,cats,b.id,{name:b.name.trim()});
  }else if(b.action==='toggleCategory'){
   result=await db.updateDocument(database,cats,b.id,{is_active:!!b.active});
  }else if(b.action==='deleteCategory'){
   const linked=await db.listDocuments(database,products,[Query.equal('category_id',b.id),Query.limit(1)]);
   if(linked.total>0)return res.json({ok:false,error:'分類仍有商品，請先移動或刪除商品'},400);
   await db.deleteDocument(database,cats,b.id);return res.json({ok:true});
  }else if(b.action==='deleteProduct'){
   await db.deleteDocument(database,products,b.id);return res.json({ok:true});
  }else if(b.action==='saveProduct'){
   const p=b.product||{};
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>150||!Number.isSafeInteger(p.price)||p.price<0||p.price>10000000||typeof p.categoryId!=='string'||!p.categoryId||String(p.description||'').length>2000||String(p.imageUrl||'').length>2000)throw Error('商品資料格式不正確');
   await db.getDocument(database,cats,p.categoryId);
   const fields={name:p.name.trim(),price:p.price,category_id:p.categoryId,description:p.description||'',image_url:p.imageUrl||'',is_active:!!p.active,sort_order:Number.isInteger(p.sort)?p.sort:0};
   result=p.$id?await db.updateDocument(database,products,p.$id,fields):await db.createDocument(database,products,ID.unique(),fields);
  }else return res.json({ok:false,error:'Unknown action'},400);
  return res.json({ok:true,id:result.$id});
 }catch(e){error(e.message);return res.json({ok:false,error:'操作失敗，請確認權限與資料格式'},400)}
};
