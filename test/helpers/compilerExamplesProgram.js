'use strict';
module.exports = function compilerExamplesProgram() {
  const {binary,token:t,integer:n,identifier:id}=require('./tokens');
  const open = screen => [t('Screen Open'),n(screen),t(','),n(320),t(','),n(32),t(','),n(4),t(','),t('Lowres')];
  return binary([open(0),[t('Cls Colour'),n(0)],
    ...[[0,0],[1,0xf00],[2,0x00f],[3,0xfff],[9,0x0f0]].map(([i,c])=>[t('Colour'),n(i),t(','),n(c)]),
    [t('Plot Colour'),n(0),t(','),n(0),t(','),n(1)],open(1),[t('Cls Colour'),n(0)],
    [t('Plot Colour'),n(1),t(','),n(0),t(','),n(1)],
    [id('a'),t('='),t('Logbase'),t('('),n(0),t(')')],
    [t('Copy'),id('a'),t(','),id('a'),t('+'),n(40),t('To'),id('a'),t('+'),n(40)],
    [t('Get Block'),n(1),t(','),n(0),t(','),n(0),t(','),n(16),t(','),n(2)],
    [t('Put Block At'),n(1),t(','),n(0),t(','),n(2)],
    [t('Dual Playfield'),n(0),t(','),n(1)],[t('Screen'),n(0)],[t('Wait Key')]]);
};
