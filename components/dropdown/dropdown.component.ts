import {Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, HostListener} from '@angular/core';
import {UIAnimation} from '../../../core-module/ui/ui-animation';
import {trigger} from '@angular/animations';
import {UIHelper} from '../../ui-helper'
import {Helper} from '../../../core-module/rest/helper';
import {OptionItem} from '../../option-item';
import {UIService} from '../../../core-module/core.module';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';

@Component({
  selector: 'dropdown',
  templateUrl: 'dropdown.component.html',
  styleUrls: ['dropdown.component.scss']
})
/**
 * The dropdown is one base component of the action bar (showing more actions), but can also be used standalone
 */
export class DropdownComponent {
  @ViewChild('dropdown', {static: true}) menu : MatMenu;
  _options: OptionItem[];
  @Input() position = 'left';
  @Input() set options(options:OptionItem[]) {
    this._options = UIHelper.filterValidOptions(this.ui,Helper.deepCopyArray(options));
  }

  /**
   * the object that should be returned via the option's callback
   * Can be null
   */
  @Input() callbackObject:any;

    /**
     * Should disabled ("greyed out") options be shown or hidden?
     * @type {boolean}
     */
    @Input() showDisabled = true;


  click(option : OptionItem) {
      if(!option.isEnabled)
          return;
      setTimeout(() => option.callback(this.callbackObject));
  }
  constructor(private ui : UIService) {

  }

  isNewGroup(i: number) {
    if (i>0) {
      return this._options[i].group !== this._options[i-1].group;
    }
    return false;
  }
}
