import { app } from './app';
import { auth } from './auth';
import { chatlib } from './chatlib';
import { closedate } from './closedate';
import { common } from './common';
import { discover } from './discover';
import { interests } from './interests';
import { hvac } from './hvac';
import { messages } from './messages';
import { reasons } from './reasons';
import { timers } from './timers';
import { tour } from './tour';
import { ui } from './ui';

export const en = { ...common.en, ...auth.en, ...timers.en, ...closedate.en, ...chatlib.en, ...reasons.en, ...hvac.en, ...discover.en, ...interests.en, ...messages.en, ...app.en, ...tour.en, ...ui.en };
export const es: Record<keyof typeof en, string> = { ...common.es, ...auth.es, ...timers.es, ...closedate.es, ...chatlib.es, ...reasons.es, ...hvac.es, ...discover.es, ...interests.es, ...messages.es, ...app.es, ...tour.es, ...ui.es };
