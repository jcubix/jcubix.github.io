const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({
 testDir:'./browser',timeout:30000,fullyParallel:true,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,workers:process.env.CI?2:2,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4202',browserName:'chromium',reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'phone-light',use:{viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:'light'}},
  {name:'phone-dark',use:{viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:'dark'}},
  {name:'desktop-light',use:{viewport:{width:1280,height:900},colorScheme:'light'}},
  {name:'desktop-dark',use:{viewport:{width:1280,height:900},colorScheme:'dark'}},
 ],
 webServer:{command:'npm run dev -- --port 4202',cwd:path.resolve(__dirname,'..'),url:'http://127.0.0.1:4202',reuseExistingServer:!process.env.CI,timeout:30000},
});
