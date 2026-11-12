'use strict';
const {binary,token:t,integer:n}=require('./tokens');
module.exports=()=>binary([[t('Print'),t('Deek'),t('('),t('Leek'),t('('),n(4),t(')'),t('+'),n(20),t(')')],[t('End')]]);
