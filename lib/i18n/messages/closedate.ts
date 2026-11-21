import { defineMessages } from './define';

export const closedate = defineMessages(
  {
    'closeP.week': '1 week',
    'closeP.twoWeeks': '2 weeks',
    'closeErr.past': 'The close date and time must be in the future.',
    'closeErr.tooFar': 'Choose a close date within the next year.',
    'close.closes': 'Closes {date}',
    'close.closedAt': 'Closed {stamp}',
    'close.closesIn': 'Closes {stamp} · in {time}',
    'close.soonTitle': 'Position closing soon',
    'close.soonMessage':
      '{title} closes in {time}. Extend the date to keep it open, or confirm that it should close then. People who are still waiting on it get their interest back, and chats stay open.',
    'close.soonManyTitle': '{count} positions closing soon',
    'close.soonManyMessage':
      '{names} will close within {time}. Open Your Positions to extend or confirm them.',
    'close.soonManyMessageMore':
      '{names} and others will close within {time}. Open Your Positions to extend or confirm them.',
    'close.closedTitle': 'Position closed',
    'close.aPosition': 'A position',
    'close.closedMessage':
      '{position} at {company} has closed, so your interest was returned. You can use it again.',
    'close.closedManyTitle': '{count} positions closed',
    'close.andMore': 'and {count} more',
    'close.closedManyMessage': '{lines}{more}\n\nYour interests were returned.',
  },
  {
    'closeP.week': '1 semana',
    'closeP.twoWeeks': '2 semanas',
    'closeErr.past': 'La fecha y la hora de cierre deben ser futuras.',
    'closeErr.tooFar': 'Elige una fecha de cierre dentro del próximo año.',
    'close.closes': 'Cierra el {date}',
    'close.closedAt': 'Cerrada el {stamp}',
    'close.closesIn': 'Cierra el {stamp} · en {time}',
    'close.soonTitle': 'Un puesto cierra pronto',
    'close.soonMessage':
      '{title} cierra en {time}. Amplía la fecha para mantenerlo abierto o confirma que debe cerrarse entonces. Quienes siguen esperando reciben de vuelta su interés, y los chats siguen abiertos.',
    'close.soonManyTitle': '{count} puestos cierran pronto',
    'close.soonManyMessage':
      '{names} cerrarán en un plazo de {time}. Abre Tus puestos para ampliarlos o confirmarlos.',
    'close.soonManyMessageMore':
      '{names} y otros cerrarán en un plazo de {time}. Abre Tus puestos para ampliarlos o confirmarlos.',
    'close.closedTitle': 'Puesto cerrado',
    'close.aPosition': 'Un puesto',
    'close.closedMessage':
      '{position} en {company} se cerró, así que se te devolvió tu interés. Puedes volver a usarlo.',
    'close.closedManyTitle': '{count} puestos cerrados',
    'close.andMore': 'y {count} más',
    'close.closedManyMessage': '{lines}{more}\n\nSe te devolvieron tus intereses.',
  }
);
