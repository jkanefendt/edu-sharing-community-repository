import {RestAdminService} from '../../../core-module/rest/services/rest-admin.service';
import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {NodeStatistics, Node, Statistics} from '../../../core-module/rest/data-object';
import {ListItem} from '../../../core-module/ui/list-item';
import {RestConstants} from '../../../core-module/rest/rest-constants';
import {RestHelper} from '../../../core-module/rest/rest-helper';
import {ConfigurationService} from '../../../core-module/rest/services/configuration.service';
import {UIHelper} from '../../../core-ui-module/ui-helper';
import {RestStatisticsService} from '../../../core-module/rest/services/rest-statistics.service';
import {AuthorityNamePipe} from '../../../core-ui-module/pipes/authority-name.pipe';
import {Toast} from '../../../core-ui-module/toast';
import {Helper} from '../../../core-module/rest/helper';
import {CsvHelper} from '../../../core-module/csv.helper';
import {SessionStorageService} from '../../../core-module/rest/services/session-storage.service';
import {RestConnectorService} from "../../../core-module/rest/services/rest-connector.service";
import {UIService} from '../../../core-module/rest/services/ui.service';
import {MdsHelper} from '../../../core-module/rest/mds-helper';
import {UIAnimation} from '../../../core-module/ui/ui-animation';
import {trigger} from '@angular/animations';
import {ListCountsComponent} from "../../../core-ui-module/components/list-table/widgets/list-counts/list-counts.component";

// Charts.js
declare var Chart: any;

type GroupTemplate = {
    name: string;
    group: string;
    unfold?: string;
    type?: 'NODES' | 'USERS';
}

@Component({
    selector: 'app-admin-statistics',
    templateUrl: 'statistics.component.html',
    styleUrls: ['statistics.component.scss'],
    animations: [
        trigger('overlay', UIAnimation.openOverlay()),
        trigger('dialog', UIAnimation.switchDialog())
    ]
})
export class AdminStatisticsComponent implements OnInit{
    @ViewChild('groupedChart') groupedChartRef: ElementRef;
    _mediacenter: any;
    private groupedChartData: { node: NodeStatistics[]; user: Statistics[] };
    nodesPermission: boolean;
    userPermission: boolean;
    finishedPreload = false;
    @Input() set mediacenter(mediacenter: any){
        this._mediacenter = mediacenter;
        this.refresh();
    }
    @Output() onOpenNode = new EventEmitter();
    static DAY_OFFSET= 1000 * 60 * 60 * 24;
    static DEFAULT_OFFSET= AdminStatisticsComponent.DAY_OFFSET * 7; // 7 days
    static DEFAULT_OFFSET_SINGLE= AdminStatisticsComponent.DAY_OFFSET * 3; // 3 days
    today = new Date();
    _groupedStart= new Date();
    _groupedEnd= new Date();
    _singleStart= new Date();
    _singleEnd= new Date();
    _customGroupStart= new Date();
    _customGroupEnd= new Date();
    _customGroup: string;
    _customUnfold = '';
    _nodesStart= new Date();
    _nodesEnd= new Date();
    customGroupRows: string[];
    additionalGroups: string[];
    customGroups: string[];
    customGroupData: any;
    customGroupLabels: any;

    _groupedMode = 'Daily';
    groupedLoading: boolean;
    singleLoading: boolean;
    customGroupLoading: boolean;
    groupedNoData: boolean;
    nodesNoData: boolean;
    _singleMode: 'NODES' | 'USERS' = 'NODES' ;
    _customGroupMode: 'NODES' | 'USERS' = 'NODES';
    singleData: any;
    singleDataRows: string[];
    groupedChart: any;
    nodesLoading: boolean;
    nodes: any[];
    columns: ListItem[];
    currentTab= 0;
    exportProperties: string;
    showModes = false;
    groupModeTemplates: GroupTemplate[];
    currentTemplate: GroupTemplate;
    showExport: boolean;

    set groupedStart(groupedStart: Date) {
        this._groupedStart = groupedStart;
        this._groupedStart.setHours(0, 0, 0);
        this.refreshGroups();
    }
    get groupedStart(){
        return this._groupedStart;
    }
    set groupedEnd(groupedEnd: Date){
        this._groupedEnd = groupedEnd;
        this._groupedEnd.setHours(23, 59, 59);
        this.refreshGroups();
    }
    get groupedEnd(){
        return this._groupedEnd;
    }
    set groupedMode(groupedMode: string){
        this._groupedMode = groupedMode;
        this.refreshGroups();
    }
    get groupedMode(){
        return this._groupedMode;
    }
    set customGroupStart(customGroupStart: Date){
        this._customGroupStart = customGroupStart;
        this._customGroupStart.setHours(0, 0, 0);
        this.refreshCustomGroups();
    }
    get customGroupStart(){
        return this._customGroupStart;
    }
    set customGroupEnd(customGroupEnd: Date){
        this._customGroupEnd = customGroupEnd;
        this._customGroupEnd.setHours(23, 59, 59);
        this.refreshCustomGroups();
    }
    get customGroupEnd(){
        return this._customGroupEnd;
    }
    set customGroup(customGroup: string){
        this._customGroup = customGroup;
        if (this.customGroup == this.customUnfold)
            this.customUnfold = null;
        this.refreshCustomGroups();
    }
    get customGroup(){
        return this._customGroup;
    }
    set customGroupMode(customGroupMode){
        this._customGroupMode = customGroupMode;
        this.refreshCustomGroups();
    }
    get customGroupMode(){
        return this._customGroupMode;
    }
    set customUnfold(customUnfold: string){
        this._customUnfold = customUnfold;
        this.refreshCustomGroups();
    }
    get customUnfold(){
        return this._customUnfold;
    }
    set singleStart(singleStart: Date){
        this._singleStart = singleStart;
        this._singleStart.setHours(0, 0, 0);
        this.refreshSingle();
    }
    get singleStart(){
        return this._singleStart;
    }
    set singleEnd(singleEnd: Date){
        this._singleEnd = singleEnd;
        this._singleEnd.setHours(23, 59, 59);
        this.refreshSingle();
    }
    get singleEnd(){
        return this._singleEnd;
    }
    set singleMode(singleMode) {
        this._singleMode = singleMode;
        this.refreshSingle();
    }
    get singleMode(){
        return this._singleMode;
    }
    set nodesStart(nodesStart: Date){
        this._nodesStart = nodesStart;
        this._nodesStart.setHours(0, 0, 0);
        this.refreshNodes();
    }
    get nodesStart(){
        return this._nodesStart;
    }
    set nodesEnd(nodesEnd: Date){
        this._nodesEnd = nodesEnd;
        this._nodesEnd.setHours(23, 59, 59);
        this.refreshNodes();
    }
    get nodesEnd(){
        return this._nodesEnd;
    }
    constructor(
        private admin: RestAdminService,
        private statistics: RestStatisticsService,
        private uiService: UIService,
        private toast: Toast,
        private storage: SessionStorageService,
        private connector: RestConnectorService,
        private translate: TranslateService,
        private config: ConfigurationService,
    ) {
        this.initColumns();
        this.groupedStart = new Date(new Date().getTime() - AdminStatisticsComponent.DEFAULT_OFFSET);
        this.groupedEnd = new Date();
        this.singleStart = new Date(new Date().getTime() - AdminStatisticsComponent.DEFAULT_OFFSET_SINGLE);
        this.singleEnd = new Date();
        this.customGroupStart = new Date(new Date().getTime() - AdminStatisticsComponent.DEFAULT_OFFSET);
        this.customGroupEnd = new Date();
        this.nodesStart = new Date(new Date().getTime() - AdminStatisticsComponent.DEFAULT_OFFSET);
        this.nodesEnd = new Date();
    }
    async ngOnInit() {
        this.groupModeTemplates = await this.config.get('admin.statistics.templates', [
            {
                name: 'group_organization',
                group: 'authority_organization',
            },
            {
                name: 'group_mediacenter',
                group: 'authority_mediacenter',
            },
            {
                name: 'group_organization_unfold_mediacenter',
                group: 'authority_organization',
                unfold: 'authority_mediacenter',
            }
        ]).toPromise();
        this.currentTemplate = this.groupModeTemplates[0];
        this.applyTemplate(this.currentTemplate, false);
        // e.g. ['school']
        this.additionalGroups = await this.config.get('admin.statistics.groups', []).toPromise();
        this.customGroups = ['authority_organization', 'authority_mediacenter'].concat(this.additionalGroups);
        if (this.customGroups.length) {
            this.customGroup = this.customGroups[0];
        }
        this.nodesPermission = this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_GLOBAL_STATISTICS_NODES);
        this.userPermission = this.connector.hasToolPermissionInstant(RestConstants.TOOLPERMISSION_GLOBAL_STATISTICS_USER);
        this.finishedPreload = true;
        this.refresh();
    }
    refresh() {
        this.refreshGroups();
        this.refreshNodes();
        this.refreshSingle();
        this.refreshCustomGroups();
    }

    private refreshGroups() {
        if(!this.finishedPreload) {
            return;
        }
        this.groupedLoading = true;
        this.statistics.getStatisticsNode(this._groupedStart, new Date(this._groupedEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), this._groupedMode, this.getMediacenter()).subscribe((dataNode) => {
            if (this._groupedMode !== 'None') {
                this.statistics.getStatisticsUser(this._groupedStart, new Date(this._groupedEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), this._groupedMode, this.getMediacenter()).subscribe((dataUser) => {
                    this.processGroupData(dataNode, dataUser);
                }, error => {
                    this.processGroupData(dataNode, null);
                });
            } else {
                this.processGroupData(dataNode, null);
            }
        }, error => {
            this.statistics.getStatisticsUser(this._groupedStart, new Date(this._groupedEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), this._groupedMode, this.getMediacenter()).subscribe((dataUser) => {
                this.processGroupData(null, dataUser);
            });
        });
    }

    getMediacenter(): string {
        return this._mediacenter ? this._mediacenter.authorityName : '';
    }

    processGroupData(dataNode: NodeStatistics[], dataUser: Statistics[]){
        this.groupedLoading = false;
        if (!dataNode || !dataNode.length) {
            this.groupedNoData = true;
            return;
        }
        this.groupedNoData = false;
        this.uiService.waitForComponent(this, 'groupedChartRef').subscribe(() => {
            const canvas: any = this.groupedChartRef.nativeElement;
            const ctx = canvas.getContext('2d');
            if (this.groupedChart) {
                this.groupedChart.destroy();
            }
            this.groupedChart = this.initGroupedChart(dataNode, dataUser, ctx);
            this.groupedChartData = {node: dataNode, user: dataUser};
        });
    }

    private initGroupedChart(dataNode: NodeStatistics[], dataUser: Statistics[], ctx: any) {
        let max = dataNode ? dataNode.map((stat) =>
            Math.max(
                stat.counts.VIEW_MATERIAL || 0,
                stat.counts.VIEW_MATERIAL_EMBEDDED || 0,
                stat.counts.DOWNLOAD_MATERIAL || 0,
                stat.counts.VIEW_MATERIAL_PLAY_MEDIA || 0)).
        reduce((a, b) => Math.max(a, b)) : 0;
        if(dataUser) {
            max = Math.max(max, dataUser.map((stat) => stat.counts.LOGIN_USER_SESSION || 0).reduce((a, b,) => Math.max(a, b)));
        }
        let chartGroupedData;
        if(dataNode) {
            chartGroupedData = {
                labels: dataNode.map((stat) => stat.date),
                datasets: [{
                    label: this.translate.instant('ADMIN.STATISTICS.VIEWS'),
                    yAxisID: 'y-axis-view',
                    backgroundColor: 'rgb(30,52,192)',
                    data: dataNode.map((stat) => stat.counts.VIEW_MATERIAL ? stat.counts.VIEW_MATERIAL : 0)
                }, {
                    label: this.translate.instant('ADMIN.STATISTICS.VIEWS_EMBEDDED'),
                    yAxisID: 'y-axis-view-embedded',
                    backgroundColor: 'rgb(117,48,192)',
                    data: dataNode.map((stat) => stat.counts.VIEW_MATERIAL_EMBEDDED ? stat.counts.VIEW_MATERIAL_EMBEDDED : 0)
                }, {
                    label: this.translate.instant('ADMIN.STATISTICS.DOWNLOADS'),
                    yAxisID: 'y-axis-download',
                    backgroundColor: 'rgb(40,146,192)',
                    data: dataNode.map((stat) => stat.counts.DOWNLOAD_MATERIAL ? stat.counts.DOWNLOAD_MATERIAL : 0)
                }, {
                    label: this.translate.instant('ADMIN.STATISTICS.VIEWS_PLAY_MEDIA'),
                    yAxisID: 'y-axis-download',
                    backgroundColor: 'rgb(192,173,40)',
                    data: dataNode.map((stat) => stat.counts.VIEW_MATERIAL_PLAY_MEDIA ? stat.counts.VIEW_MATERIAL_PLAY_MEDIA : 0)
                }],
            };
        } else {
            chartGroupedData = {
                labels: [],
                datasets: [],
            };
        }
        const axes = [{
            type: 'linear',
            display: true,
            position: 'left',
            id: 'y-axis-view',
            ticks: {
                beginAtZero: true,
                max,
                min: 0
            }
        }, {
            type: 'linear',
            display: false,
            id: 'y-axis-view-embedded',
            ticks: {
                beginAtZero: true,
                max,
                min: 0
            }
        }, {
            type: 'linear',
            display: false,
            id: 'y-axis-download',
            ticks: {
                beginAtZero: true,
                max,
                min: 0
            }
        }];
        if (dataUser) {
            chartGroupedData.datasets.push({
                label: this.translate.instant('ADMIN.STATISTICS.USER_LOGINS'),
                yAxisID: 'y-axis-user',
                backgroundColor: 'rgb(22,192,73)',
                data: dataUser.map((stat) => stat.counts.LOGIN_USER_SESSION ? stat.counts.LOGIN_USER_SESSION : 0)
            });
            axes.push({
                type: 'linear',
                display: false,
                id: 'y-axis-user',
                ticks: {
                    beginAtZero: true,
                    max,
                    min: 0
                }
            });
        }

        Chart.defaults.global.defaultFontFamily = 'inherit';
        return new Chart(ctx, {
            type: 'bar',
            data: chartGroupedData,
            options: {
                responsive: true,
                aspectRatio: 3,
                legend: {
                    display: true
                },
                mode: 'index',
                scales: {
                    yAxes: axes,
                }
            }
        });
    }

    private refreshNodes() {
        if(!this.finishedPreload) {
            return;
        }
        this.nodes = [];
        this.nodesLoading = true;
        const group = this.config.instant('admin.statistics.nodeGroup');
        this.statistics.getStatisticsNode(this._nodesStart, new Date(this._nodesEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), 'Node',
            this.getMediacenter(), group ?[group] : null).subscribe((data) => {
            this.nodesLoading = false;
            this.nodesNoData = data.length === 0;
            this.nodes = data.map((stat) => {
                (stat.node as any).counts = stat;
                return stat.node;
            });
        });
    }
    getValidMode(mode: 'NODES' | 'USERS'){
        if (!this._mediacenter) {
            if(!this.nodesPermission) {
                mode = 'USERS';
            } else if(!this.userPermission) {
                mode = 'NODES';
            }
        }
        return mode;
    }
    private refreshSingle() {
        if(!this.finishedPreload) {
            return;
        }
        this.singleDataRows = null;
        this.singleLoading = true;
        const mode = this.getValidMode(this._singleMode);
        if (mode === 'NODES') {
            this.singleDataRows = ['date', 'action', 'node', 'authority', 'authority_organization', 'authority_mediacenter'].concat(this.additionalGroups || []);
            this.statistics.getStatisticsNode(this._singleStart, new Date(this._singleEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), 'None', this.getMediacenter(), this.additionalGroups).subscribe((result) => {
                this.singleData = result.map((entry) => {
                    return {action: Object.keys(entry.counts)[0], date: entry.date, node: RestHelper.getName(entry.node), authority: entry.authority, entry};
                });
                this.singleLoading = false;
            });
        }
        if (mode === 'USERS') {
            this.singleDataRows = ['date', 'action', 'authority', 'authority_organization', 'authority_mediacenter'].concat(this.additionalGroups || []);
            this.statistics.getStatisticsUser(this._singleStart, new Date(this._singleEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), 'None', this.getMediacenter(), this.additionalGroups).subscribe((result) => {
                this.singleData = result.map((entry) => {
                    return {action: Object.keys(entry.counts)[0], date: entry.date, authority: entry.authority, entry};
                });
                this.singleLoading = false;
            });
        }
    }

    private refreshCustomGroups() {
        if(!this.finishedPreload) {
            return;
        }
        if (!this.customGroups) {
            return;
        }
        this.customGroupData = null;
        this.customGroupLoading = true;
        this.customGroupRows = [];
        const handleResult = (result: Statistics[]) => {
            this.customGroupRows = ['action'].concat(this.customGroup).concat('count');
            if (this.customUnfold){
                // add all found values as a matrix
                /*
                let set = Array.from(new Set( result.map((entry) => Object.keys(entry.groups[this.customUnfold])).
                    reduce((a, b) => a.concat(b)).
                    filter((a) => a != '')
                ));
                 */
                let set = Array.from(new Set( result.map((entry) =>
                    Object.keys(entry.groups).map((type) =>
                        Object.keys(entry.groups[type][this.customUnfold])).
                    reduce((a, b) => a.concat(b)).
                    filter((a: string) => a != ''))
                ));
                // flatten [['test'],...] to a string array
                set = [].concat(...set);
                // container for storing the display (transformed authorities names) data for the table view
                this.customGroupLabels = [];
                if (this.customUnfold == 'authority_organization' || this.customUnfold == 'authority_mediacenter'){
                    // transform the value for the horizontal list data if it's org/group
                    set = set.map((key: any) => {
                        const authority = result.map((entry) => ((this.customUnfold == 'authority_organization' ? entry.authority.organization : entry.authority.mediacenter as any[])))
                            .reduce((a, b) => a.concat(b))
                            .filter((a) => a.authorityName == key);
                        if (authority.length) {
                            this.customGroupLabels[key] = new AuthorityNamePipe(this.translate).transform(authority[0], null);
                        }
                        return key;
                    });
                }
                this.customGroupRows = Array.from(new Set(this.customGroupRows.concat(set as any)));
            }
            if (result.length) {
                this.customGroupData = result.map((entry) => {
                    const result = [];
                    for (const key in entry.counts) {
                        let displayValue = entry.fields[this.customGroup];
                        // transform the value for the vertical list data if it's org/group
                        if (this.customGroup == 'authority_organization' || this.customGroup == 'authority_mediacenter'){
                            const obj = (((this.customGroup == 'authority_organization' ? entry.authority.organization : entry.authority.mediacenter) as any));
                            if (obj) {
                                displayValue = obj.map((group: any) => {
                                    return new AuthorityNamePipe(this.translate).transform(group, null);
                                }).join(', ');
                            }
                            else{
                                displayValue = '';
                            }

                        }
                        result.push({entry, displayValue, count: entry.counts[key], action: key});
                    }
                    return result;
                }).reduce((a, b) => a.concat(b));
            }
            this.customGroupLoading = false;
        };
        const mode = this.getValidMode(this._customGroupMode);
        if (mode === 'NODES') {
            this.statistics.getStatisticsNode(this._customGroupStart, new Date(this._customGroupEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), 'None', this.getMediacenter(), this.customUnfold ? [this.customUnfold] : null, [this.customGroup]).subscribe((result) => {
                handleResult(result);
            });
        }
        if (mode === 'USERS') {
            this.statistics.getStatisticsUser(this._customGroupStart, new Date(this._customGroupEnd.getTime() + AdminStatisticsComponent.DAY_OFFSET), 'None', this.getMediacenter(), this.customUnfold ? [this.customUnfold] : null, [this.customGroup]).subscribe((result) => {
                handleResult(result);
            });
        }
    }

    getGroupKey(element: any, key: string) {
        const data = element.entry?.groups?.[element.action]?.[key];
        return data ? Object.keys(data)[0] : null;
    }

    export() {
        let csvHeadersTranslated: string[];
        let csvHeadersMapping: string[];
        let csvData: any;
        // node export
        switch (this.currentTab) {
            // chart per day/month/year data
            case 0: {
                if (this.groupedChartData.node) {
                    // map the headings for the file
                    const data = (this.groupedChartData.node as any).concat(this.groupedChartData.user);
                    csvHeadersMapping = Helper.uniqueArray(data.map((d: any) => Object.keys(d.counts)).reduce((a: any, b: any) => a.concat(b)));
                    csvHeadersTranslated = csvHeadersMapping.map(s => this.translate.instant('ADMIN.STATISTICS.ACTIONS.' + s));
                    csvHeadersMapping.splice(0, 0, 'Date');
                    csvHeadersTranslated.splice(0, 0, this.translate.instant('ADMIN.STATISTICS.HEADERS.date'));
                    const result: any = {};
                    data.forEach((d: any) => {
                        if (!result[d.date]) {
                            result[d.date] = {Date: d.date};
                        }
                        Object.keys(d.counts).forEach((c) => {
                            result[d.date][c] = d.counts[c];
                        });
                    });
                    csvData = Helper.objectToArray(result);
                } else {
                    this.toast.error('ADMIN.STATISTICS.EXPORT_NO_DATA');
                }
                break;
            }
            case 1: {
                // grouped / folded data
                csvHeadersMapping = this.customGroupRows.map((h) => {
                    return this.customGroupLabels?.[h] || h;
                });
                csvHeadersTranslated = csvHeadersMapping.map(
                    s => this.translate.instant('ADMIN.STATISTICS.HEADERS.' + s)
                );
                csvData = this.customGroupData.map((c: any) => {
                    c[this.customGroup] = c.displayValue;
                    console.log(c);
                    for (const key of this.customGroupRows) {
                        if (key === 'action' || key === 'count' || key === this.customGroup) {
                            continue;
                        }
                        c[this.customGroupLabels?.[key] || key] = c.entry.groups[c.action]?.[this.customUnfold]?.[key];
                    }
                    return c;
                });
                console.log(csvHeadersTranslated, csvData);
                break;
            }
            case 2: {
                // counts by node including custom properties
                const properties = this.exportProperties.split('\n')
                    .map((e) => e.trim())
                this.storage.set('admin_statistics_properties', this.exportProperties);
                //csvHeaders = properties.concat(Helper.uniqueArray(this.nodes.map((n) => Object.keys(n.counts)).reduce((a: any, b: any) => a.concat(b))));
                const countHeaders = ['OVERALL', 'VIEW_MATERIAL', 'VIEW_MATERIAL_EMBEDDED', 'DOWNLOAD_MATERIAL']
                csvHeadersMapping = properties.concat(countHeaders);
                csvHeadersTranslated = properties
                    .map(e => this.translate.instant('NODE.' + e))
                    .concat(
                        countHeaders.map((s) => this.translate.instant('NODE.counts.' + s))
                    );
                csvData = this.nodes.map((n) => {
                    const c: any = {};
                    console.log(Object.keys(n.counts));
                    for (const prop of properties) {
                        c[prop] = n.properties ? n.properties[prop] : n.ref.id;
                        for(const idx of countHeaders) {
                            c[idx] = ListCountsComponent.getCount(n, idx);
                        }
                    }
                    return c;
                });
                break;
            }
            case 3: {
                csvHeadersMapping = this.singleDataRows;
                csvHeadersTranslated = this.singleDataRows.map((s) => this.translate.instant('ADMIN.STATISTICS.HEADERS.' + s));
                console.log(this.singleData);
                csvData = this.singleData.map((data: any) => {
                    const c: any = Helper.deepCopy(data);
                    // c.action = this.translate.instant('ADMIN.STATISTICS.ACTIONS.' + data.action);
                    c.authority = data.authority.hash.substring(0, 8);
                    c.authority_organization = data.authority.organization.map((m: any) => new AuthorityNamePipe(this.translate).transform((m)));
                    c.authority_mediacenter = data.authority.mediacenter.map((m: any) => new AuthorityNamePipe(this.translate).transform((m)));
                    const mainGroup = data.entry.groups[Object.keys(data.entry.groups)[0]];
                    if(mainGroup) {
                        for (const additional of Object.keys(mainGroup)) {
                            c[additional] = Object.keys(mainGroup[additional])[0];
                        }
                    }
                    return c;
                });
                break;
            }
        }
        CsvHelper.download(this.translate.instant('ADMIN.STATISTICS.CSV_FILENAME'), csvHeadersTranslated, csvData, csvHeadersMapping);
    }

    private initColumns() {
        const columns: string[] = this.config.instant('admin.statistics.nodeColumns');
        if(columns) {
            this.columns = columns.map((c) => new ListItem('NODE', c));
        } else {
            this.columns = [new ListItem('NODE', RestConstants.CM_NAME)];
        }
        this.storage.get('admin_statistics_properties', this.columns.map((c) => c.name).join('\n'))
            .subscribe((p) => this.exportProperties = p);


        this.columns = this.columns.concat([
            new ListItem('NODE', 'counts.OVERALL'),
            new ListItem('NODE', 'counts.VIEW_MATERIAL'),
            new ListItem('NODE', 'counts.VIEW_MATERIAL_EMBEDDED'),
            new ListItem('NODE', 'counts.DOWNLOAD_MATERIAL'),
            new ListItem('NODE', 'counts.VIEW_MATERIAL_PLAY_MEDIA'),
        ]);
    }

    applyTemplate(template: GroupTemplate, refresh = true) {
        this._customGroup = template.group;
        this._customUnfold = template.unfold ?? '';
        this._customGroupMode = template.type ?? 'NODES';
        if (refresh) {
            this.refreshCustomGroups();
        }
    }
}
