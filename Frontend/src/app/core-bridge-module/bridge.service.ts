import {Injectable, Injector} from '@angular/core';
import {Toast} from "../core-ui-module/toast";
import {CordovaService} from "../common/services/cordova.service";
import {DialogButton} from "../core-module/core.module";
import {Translation} from "../core-ui-module/translation";
import {MessageType} from "../core-module/ui/message-type";
import {ModalDialogOptions} from '../common/ui/modal-dialog-toast/modal-dialog-toast.component';
import {ProgressType} from '../common/ui/modal-dialog/modal-dialog.component';

@Injectable()
export class BridgeService {
    constructor(private injector : Injector,private cordova : CordovaService) {

    }
    showTemporaryMessage(type:MessageType,message:string|any,messageParameters: any = null, additional: any = null, error: any = null) {
       if (type === MessageType.info) {
           this.injector.get(Toast).toast(message, messageParameters, null, null, additional);
       } else if (type === MessageType.error) {
           this.injector.get(Toast).error(error, message ? message : 'COMMON_API_ERROR', messageParameters, null, null, additional);
       }
    }
    closeModalDialog() {
        this.injector.get(Toast).closeModalDialog();
    }
    showModalDialog(options: ModalDialogOptions) {
        this.injector.get(Toast).showConfigurableDialog(options);
    }
    showError(errorObject: any) {
        this.injector.get(Toast).error(errorObject);
    }
    showProgressDialog(title= 'PROGRESS_DIALOG_DEFAULT_TITLE', message= 'PROGRESS_DIALOG_DEFAULT_MESSAGE', type = ProgressType.Indeterminate) {
        this.injector.get(Toast).showProgressDialog(title, message, type);
    }
    isRunningCordova() {
        return this.cordova.isRunningCordova();
    }
    getCordova() {
        return this.cordova;
    }

    getISOLanguage() {
        return Translation.getISOLanguage();
    }
}
