import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class NotificationEvent {
    constructor(private eventEmitter: EventEmitter2) { }

    emitNewNotification(userId: number, notification: any) {
        this.eventEmitter.emit('notification.new', { userId, notification });
    }

    emitNotificationUpdate(userId: number, data: any) {
        this.eventEmitter.emit('notification.update', { userId, data });
    }
}