import {ChangeDetectorRef, Component, EventEmitter, Input, Output} from '@angular/core';
import {RestConnectorService} from "../../../core-module/core.module";
import {Toast} from "../../../core-ui-module/toast";
import {PlatformLocation} from "@angular/common";
import {ActivatedRoute, Router, UrlSerializer} from "@angular/router";
import {TranslateService} from "@ngx-translate/core";
import {ConfigurationService} from "../../../core-module/core.module";
import {Title} from "@angular/platform-browser";
import {SessionStorageService} from "../../../core-module/core.module";
import {UIConstants} from "../../../core-module/ui/ui-constants";
import {RestRegisterService} from '../../../core-module/core.module';
import {UIHelper} from "../../../core-ui-module/ui-helper";
import {CordovaService} from "../../../common/services/cordova.service";
import {RestLocatorService} from "../../../core-module/core.module";

@Component({
  selector: 'app-register-done',
  templateUrl: 'register-done.component.html',
  styleUrls: ['register-done.component.scss']
})
export class RegisterDoneComponent {
    @Output() onModify = new EventEmitter<void>();
    @Output() onStateChanged=new EventEmitter<void>();
    @Input() inputState:string;
    loading=false;
    email = '';
    keyInput = '';
    private _keyUrl = '';
    private static STATUS_INTERVAL = 5000;
    private activated = false;
    get keyUrl(){
        return this._keyUrl;
    }
    set keyUrl(keyUrl:string){
        this._keyUrl=keyUrl;
        this.loading=true;
        this.activate(keyUrl);
    }

    public editMail() {
        this.onModify.emit();
    }
    public sendMail(){
        this.loading=true;
        this.changes.detectChanges();
        if(this.inputState=='done') {
            this.register.resendMail(this.email).subscribe(() => {
                this.toast.toast("REGISTER.TOAST");
                this.loading=false;
                this.changes.detectChanges();
            },(error)=>{
                this.loading=false;
                this.changes.detectChanges();
            });
        }
        else{
            this.register.recoverPassword(this.email).subscribe(()=>{
                this.loading=false;
                this.changes.detectChanges();
            },(error)=>{
                this.loading=false;
                this.changes.detectChanges();
            });
        }
    }
    constructor(private connector: RestConnectorService,
                private toast: Toast,
                private register: RestRegisterService,
                private platformLocation: PlatformLocation,
                private config: ConfigurationService,
                private cordova: CordovaService,
                private changes: ChangeDetectorRef,
                private locator: RestLocatorService,
                private router: Router
    ) {
        setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
    }

    // loop and check if the user has already registered in an other tab
    private checkStatus() {
        if(this.activated){
            return;
        }
        if(this.inputState!='done') {
            setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
            return;
        }
        this.register.exists(this.email).subscribe((status)=>{
            if(status.exists){
                this.router.navigate([UIConstants.ROUTER_PREFIX,"login"],{queryParams:{"username":this.email}});
                return;
            }
            setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
        },(error)=>{
            setTimeout(()=>this.checkStatus(),RegisterDoneComponent.STATUS_INTERVAL);
        });
    }
    public activate(keyUrl: string) {
        this.loading=true;
        this.changes.detectChanges();
        if(this.inputState=='done') {
            this.register.activate(keyUrl).subscribe(() => {
                this.activated = true;
                if(this.cordova.isRunningCordova()){
                    this.locator.createOAuthFromSession().subscribe(()=>{
                        UIHelper.goToDefaultLocation(this.router, this.platformLocation, this.config);
                    },(error)=>{
                        this.toast.error(error);
                    });
                }
                else {
                    UIHelper.goToDefaultLocation(this.router, this.platformLocation, this.config);
                }
            }, (error) => {
                if (error?.error?.error.includes('DAOInvalidKeyException')) {
                    this.toast.error(null, 'REGISTER.TOAST_INVALID_KEY');
                }
                else {
                    this.toast.error(error);
                }
                this.loading = false;
                this.changes.detectChanges();
            });
        }
        else{
            this.router.navigate([UIConstants.ROUTER_PREFIX,"register","reset-password",this.keyInput]);
        }
    }
}
