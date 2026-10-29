'use strict';
// Declared synthetic direct-sprite matrix using the independent two-row bank.
// This is not a Planet Zybex gameplay excerpt.
module.exports = function spriteBufferProgram() {
  const {binary,token:t,integer:n}=require('./tokens'),a=require('./attachedSprite');
  const key=[t('Wait Key')],size=value=>[t('Set Sprite Buffer'),n(value)];
  return a.source([...a.palette,[t('Change Mouse'),n(2)],size(48),[t('Hide On')],[t('Sprite Update Off')],a.sprite(1),[t('Sprite Update')],key,
    size(48),key,size(64),key,[t('Hide On')],a.sprite(1,148),[t('Sprite Update')],key,
    [t('Default')],[t('Flash Off')],[t('Curs Off')],[t('Cls Colour'),n(0)],key]);
};
