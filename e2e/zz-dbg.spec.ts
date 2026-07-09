import { test } from "@playwright/test";
import { toCrossJSONAsync } from "seroval";
test("dbg", async ({ page }) => {
  const REF="qgooptqlfjumspfsvxvt"; const KEY=`sb-${REF}-auth-token`;
  const s={access_token:"t",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:"r",user:{id:"u1",aud:"authenticated",role:"authenticated",email:"team@example.com",app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}};
  const LID="11111111-1111-1111-1111-111111111111";
  await page.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(s)] as const);
  await page.route("**/auth/v1/**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(r.request().url().includes("/user")?s.user:s)}));
  await page.route("**/rest/v1/**",r=>{const u=r.request().url();const b=u.includes("/rest/v1/leads")?[{id:LID,name:"Ada Retryable",email:"a@e.com",phone:null,source:"test",status:"new",notes:null,created_at:new Date().toISOString()}]:[];return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(b)});});
  const sfj=async(r,data)=>r.fulfill({status:200,headers:{"content-type":"application/json","x-tss-serialized":"true"},body:JSON.stringify(await toCrossJSONAsync(data,{}))});
  const sf=(r)=> r.request().method()==="POST" ? sfj(r,{requeued:1,suppressed:0,failed:0,notFound:0}) : sfj(r,[{message_id:"m",status:"failed",error_message:null,error_detail:null,created_at:new Date().toISOString(),lead_id:LID,lead_email:"a@e.com"}]);
  await page.route("**/_serverFn/**",sf); await page.route("**/ln/**",sf);
  page.on("console",m=>{ if(m.type()==="error" && !m.text().includes("hydrat")) console.log("CERR", m.text().slice(0,200)); });
  await page.goto("/crm?notify=all");
  await page.waitForTimeout(6000);
  console.log("ALERTROW", await page.locator("table tbody tr").first().innerText().catch(()=>"?"));
  console.log("HAScb", await page.getByLabel("Select Ada Retryable").count());
});
