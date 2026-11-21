import { defineMessages } from './define';

export const chatlib = defineMessages(
  {
    'rw.what': 'a {time} reply time',
    'rw.accepted': '{name} agreed to {what}.',
    'rw.declined': '{name} declined {what}.',
    'rw.expired': "{name} didn't answer your request for {what} in time, so it expired.",
    'rw.titleAccepted': 'Reply time changed',
    'rw.titleDeclined': 'Request declined',
    'rw.titleExpired': 'Request expired',
    'rw.stays': ' The reply time stays as it was.',
    'rw.manyTitle': '{count} reply time updates',
    'rw.incomingTitle': 'Reply time request',
    'rw.incomingMessage':
      '{name} would like to change your reply time to {time}. Open the chat to accept or decline.',
    'chat.today': 'Today',
    'chat.yesterday': 'Yesterday',
    'chat.messageDeleted': 'Message deleted',
    'rating.detail_one': '{onTime} of {total} reply on time',
    'rating.detail_other': '{onTime} of {total} replies on time',
  },
  {
    'rw.what': 'un tiempo de respuesta de {time}',
    'rw.accepted': '{name} aceptó {what}.',
    'rw.declined': '{name} rechazó {what}.',
    'rw.expired': '{name} no respondió a tu solicitud de {what} a tiempo, así que venció.',
    'rw.titleAccepted': 'Tiempo de respuesta cambiado',
    'rw.titleDeclined': 'Solicitud rechazada',
    'rw.titleExpired': 'Solicitud vencida',
    'rw.stays': ' El tiempo de respuesta sigue igual.',
    'rw.manyTitle': '{count} actualizaciones del tiempo de respuesta',
    'rw.incomingTitle': 'Solicitud de tiempo de respuesta',
    'rw.incomingMessage':
      '{name} quiere cambiar tu tiempo de respuesta a {time}. Abre el chat para aceptar o rechazar.',
    'chat.today': 'Hoy',
    'chat.yesterday': 'Ayer',
    'chat.messageDeleted': 'Mensaje eliminado',
    'rating.detail_one': '{onTime} de {total} respuesta a tiempo',
    'rating.detail_other': '{onTime} de {total} respuestas a tiempo',
  }
);
