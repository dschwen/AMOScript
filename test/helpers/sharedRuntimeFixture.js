'use strict';
const {binary,token:t,integer:n,text}=require('./tokens');
module.exports=()=>({source:binary([[t('Run'),text('next.amos')]]),programs:{'next.amos':binary([[t('Screen Open'),n(0),t(','),n(160),t(','),n(64),t(','),n(4),t(','),n(0)],[t('Cls'),n(2)],[t('Print'),text('Shared runtime fixture')],[t('End')]]).toString('base64')}});
