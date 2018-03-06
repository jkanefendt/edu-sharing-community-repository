
import {Component, Input, Output, EventEmitter, HostListener, ChangeDetectorRef, ApplicationRef} from "@angular/core";
import {
  Group, IamGroups, IamUsers, NodeList, IamUser, IamAuthorities,
  Authority, OrganizationOrganizations, Organization
} from "../../../common/rest/data-object";
import {Toast} from "../../../common/ui/toast";
import {ActivatedRoute} from "@angular/router";
import {RestIamService} from "../../../common/rest/services/rest-iam.service";
import {TranslateService} from "@ngx-translate/core";
import {RestConnectorService} from "../../../common/rest/services/rest-connector.service";
import {OptionItem} from "../../../common/ui/actionbar/option-item";
import {DialogButton} from "../../../common/ui/modal-dialog/modal-dialog.component";
import {UIAnimation} from "../../../common/ui/ui-animation";
import {SuggestItem} from "../../../common/ui/autocomplete/autocomplete.component";
import {NodeHelper} from "../../../common/ui/node-helper";
import {RestConstants} from "../../../common/rest/rest-constants";
import {RestOrganizationService} from "../../../common/rest/services/rest-organization.service";
import {RestNodeService} from "../../../common/rest/services/rest-node.service";
import {ConfigurationService} from "../../../common/services/configuration.service";
import {Helper} from "../../../common/helper";
import {trigger} from "@angular/animations";
import {ListItem} from "../../../common/ui/list-item";
import {RestAdminService} from '../../../common/rest/services/rest-admin.service';
import {AuthorityNamePipe} from '../../../common/ui/authority-name.pipe';
@Component({
  selector: 'toolpermission-manager',
  templateUrl: 'toolpermission-manager.component.html',
  styleUrls: ['toolpermission-manager.component.scss'],
  animations: [
      trigger('fade', UIAnimation.fade()),
      trigger('cardAnimation', UIAnimation.cardAnimation())
  ]
})
export class ToolpermissionManagerComponent {
  isLoading=false;
  static STATUS_ALLOWED="ALLOWED";
  static STATUS_DENIED="DENIED";
  static STATUS_UNDEFINED="UNDEFINED";
  static STATUS_UNKNOWN="UNKNOWN";
  static GROUPS:any={
    "SHARING":[
        RestConstants.TOOLPERMISSION_INVITE,
        RestConstants.TOOLPERMISSION_INVITE_SHARE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SHARE,
        RestConstants.TOOLPERMISSION_INVITE_HISTORY,
        RestConstants.TOOLPERMISSION_INVITED,
    ],
    "LICENSING":[
        RestConstants.TOOLPERMISSION_INVITE_ALLAUTHORITIES,
        RestConstants.TOOLPERMISSION_LICENSE,
    ],
    "DATA_MANAGEMENT":[
        RestConstants.TOOLPERMISSION_WORKSPACE,
        RestConstants.TOOLPERMISSION_UNCHECKEDCONTENT
    ],
    "SAFE":[
        RestConstants.TOOLPERMISSION_CONFIDENTAL,
        RestConstants.TOOLPERMISSION_INVITE_SAFE,
        RestConstants.TOOLPERMISSION_INVITE_SHARE_SAFE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SAFE,
        RestConstants.TOOLPERMISSION_GLOBAL_AUTHORITY_SEARCH_SHARE_SAFE,
    ],
    "COLLECTIONS":[
        RestConstants.TOOLPERMISSION_COLLECTION_EDITORIAL,
        RestConstants.TOOLPERMISSION_COLLECTION_CURRICULUM,
        RestConstants.TOOLPERMISSION_COLLECTION_PINNING,
    ],
    "OTHER":null
  }
  getGroups(){
    return ToolpermissionManagerComponent.GROUPS;
  }
  getToolpermissionsForGroup(group:string){
    if(ToolpermissionManagerComponent.GROUPS[group]){
      return ToolpermissionManagerComponent.GROUPS[group];
    }
    let permissions=Object.keys(this.permissions);
    for(let group in ToolpermissionManagerComponent.GROUPS){
      if(ToolpermissionManagerComponent.GROUPS[group]){
        for(let tp of ToolpermissionManagerComponent.GROUPS[group]){
          let pos=permissions.indexOf(tp);
          if(pos!=-1) {
              permissions.splice(pos, 1);
          }
        }
      }
    }
    return permissions;
  }
  private _authority: any;
  name:string;
  @Input() set authority(authority:any){
    if(authority==null)
      return;
    this.name=new AuthorityNamePipe().transform(authority,null);
    this.isLoading=true;
    this._authority=authority;
    this.admin.getToolpermissions(authority.authorityName).subscribe((data:any)=>{
        this.isLoading=false;
        this.permissions=data;
        this.allow={};
        this.deny={};
        for(let key in this.permissions){
          let value=this.permissions[key].explicit;
          this.allow[key]=value==ToolpermissionManagerComponent.STATUS_ALLOWED;
          this.deny[key]=value==ToolpermissionManagerComponent.STATUS_DENIED;
        }
        this.allowInit=Helper.deepCopy(this.allow);
        this.denyInit=Helper.deepCopy(this.deny);
    },(error:any)=>{
        this.toast.error(error);
        this.close();
    });
  }
  @Output() onClose = new EventEmitter();
  permissions: any;
  allow: any;
  allowInit: any;
  deny: any;
  denyInit: any;

  constructor(private toast: Toast,
              private admin : RestAdminService,
              private iam: RestIamService) {

  }
  close(){
    this.onClose.emit();
  }
  save(){
    this.isLoading=true;
    this.admin.setToolpermissions(this._authority.authorityName,this.getPermissions()).subscribe(()=>{
        this.isLoading=false;
        this.toast.toast('PERMISSIONS.TOOLPERMISSIONS.SAVED');
        this.close();
    });
  }
  getEffective(key:string) {
    if(this.deny[key]){
      return ToolpermissionManagerComponent.STATUS_DENIED;
    }
    if(this.allow[key] && this.permissions[key].effective!=ToolpermissionManagerComponent.STATUS_DENIED){
      return ToolpermissionManagerComponent.STATUS_ALLOWED;
    }
    if(!this.denyInit[key] && this.permissions[key].effective==ToolpermissionManagerComponent.STATUS_DENIED){
      return ToolpermissionManagerComponent.STATUS_DENIED;
    }
    if(this.allow[key]!=this.allowInit[key] || this.deny[key]!=this.denyInit[key]) {
      return ToolpermissionManagerComponent.STATUS_UNKNOWN;
    }
    return this.permissions[key].effective;
  }
  isImplicit(key:string) {
    if(this.getEffective(key)==ToolpermissionManagerComponent.STATUS_UNKNOWN)
      return false;
    if(this.deny[key]){
        return false;
    }
    if(this.allow[key] && this.permissions[key].effective==ToolpermissionManagerComponent.STATUS_DENIED){
        return true;
    }
    return !this.allow[key];
  }

  private getPermissions() {
      let result:any={};
      for(let key in this.permissions){
        if(this.allow[key]){
          result[key]=ToolpermissionManagerComponent.STATUS_ALLOWED;
        }
        else if(this.deny[key]){
          result[key]=ToolpermissionManagerComponent.STATUS_DENIED;
        }
      }
      return result;
  }
}
