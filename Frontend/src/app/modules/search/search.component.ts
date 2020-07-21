import { trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {ActivatedRoute, Params, Router} from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import 'rxjs/add/operator/map';
import { Subscription } from 'rxjs/Subscription';
import { ActionbarHelperService } from '../../common/services/actionbar-helper';
import { ActionbarComponent } from '../../common/ui/actionbar/actionbar.component';
import { GlobalContainerComponent } from '../../common/ui/global-container/global-container.component';
import { MainNavComponent } from '../../common/ui/main-nav/main-nav.component';
import { MdsComponent } from '../../common/ui/mds/mds.component';
import { BridgeService } from '../../core-bridge-module/bridge.service';
import { CollectionWrapper, ConfigurationHelper, ConfigurationService, DialogButton, ListItem, LoginResult, MdsInfo, MdsMetadatasets, NetworkRepositories, Node, NodeList, NodeWrapper, Repository, RestCollectionService, RestConnectorService, RestConstants, RestHelper, RestIamService, RestMdsService, RestNetworkService, RestNodeService, RestSearchService, SearchList, SessionStorageService, SortItem, TemporaryStorageService, UIService } from '../../core-module/core.module';
import { Helper } from '../../core-module/rest/helper';
import { MdsHelper } from '../../core-module/rest/mds-helper';
import { UIAnimation } from '../../core-module/ui/ui-animation';
import {OPEN_URL_MODE, UIConstants} from '../../core-module/ui/ui-constants';
import { ListTableComponent } from '../../core-ui-module/components/list-table/list-table.component';
import { NodeHelper } from '../../core-ui-module/node-helper';
import {CustomOptions, OptionItem, Scope} from '../../core-ui-module/option-item';
import { Toast } from '../../core-ui-module/toast';
import { Translation } from '../../core-ui-module/translation';
import { UIHelper } from '../../core-ui-module/ui-helper';
import { SearchService } from './search.service';
import { WindowRefService } from './window-ref.service';

@Component({
    selector: 'app-search',
    templateUrl: 'search.component.html',
    styleUrls: ['search.component.scss'],
    providers: [WindowRefService],
    animations: [trigger('fromLeft', UIAnimation.fromLeft())],
})
export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
    readonly SCOPES = Scope;

    @ViewChild('mdsMobile') mdsMobileRef: MdsComponent;
    @ViewChild('mdsDesktop') mdsDesktopRef: MdsComponent;
    @ViewChild('list') list: ListTableComponent;
    @ViewChild('mainNav') mainNavRef: MainNavComponent;
    @ViewChild('extendedSearch') extendedSearch: ElementRef;
    @ViewChild('toolbar') toolbar: any;

    toolPermissions: string[];
    searchFail: boolean = false;
    innerWidth: number = 0;
    breakpoint: number = 800;
    initalized: boolean;
    tutorialElement: ElementRef;
    mdsSuggestions: any = {};
    mdsExtended = false;
    sidenavTab = 0;
    collectionsMore = false;
    nodeReport: Node;
    nodeVariant: Node;
    currentRepository: string = RestConstants.HOME_REPOSITORY;
    currentRepositoryObject: Repository;
    applyMode = false;
    hasCheckbox = false;
    showMoreRepositories = false;
    savedSearchOptions: CustomOptions = {
        useDefaultOptions: false
    };
    isGuest = false;
    mainnav = true;
    hasMoreCollections = false;
    queryId = RestConstants.DEFAULT_QUERY_NAME;
    groupResults = false;
    actionOptions: OptionItem[] = [];
    allRepositories: Repository[];
    repositories: Repository[];
    globalProgress = false;
    addNodesToCollection: Node[];
    addNodesStream: Node[];
    oldParams: Params;
    get mdsId() {
        return this._mdsId;
    }
    set mdsId(mdsId: string) {
        this._mdsId = mdsId;
    }
    selection: Node[];
    extendedRepositorySelected = false;
    savedSearch: Node[] = [];
    savedSearchColumns: ListItem[] = [];
    saveSearchDialog = false;
    savedSearchLoading = false;
    savedSearchQuery: string = null;
    savedSearchQueryModel: string = null;
    addToCollection: Node;

    private renderedNode: Node;
    private viewToggle: OptionItem;
    // Max items to fetch at all (afterwards no more infinite scroll)
    private static MAX_ITEMS_COUNT = 500;
    private repositoryIds: any[] = [];
    private mdsSets: MdsInfo[];
    private _mdsId: string;
    private isSearching = false;
    private groupedRepositories: Repository[];
    private enabledRepositories: string[];
    // we only initalize the banner once to prevent flickering
    private bannerInitalized = false;
    private currentValues: any;
    private currentMdsSet: any;
    private mdsActions: OptionItem[];
    private mdsButtons: DialogButton[];
    private currentSavedSearch: Node;
    private login: LoginResult;
    private savedSearchOwn = true;
    private queryParamsSubscription: Subscription;
    private nodeDisplayed: Node;
    customOptions: CustomOptions = {
        useDefaultOptions: true
    };

    constructor(
        private router: Router,
        private http: HttpClient,
        private connector: RestConnectorService,
        private RestNodeService: RestNodeService,
        private mdsService: RestMdsService,
        private bridge: BridgeService,
        private iam: RestIamService,
        private search: RestSearchService,
        private collectionApi: RestCollectionService,
        private actionbar: ActionbarHelperService,
        private nodeApi: RestNodeService,
        private toast: Toast,
        private translate: TranslateService,
        private activatedRoute: ActivatedRoute,
        private winRef: WindowRefService,
        public searchService: SearchService,
        private title: Title,
        private config: ConfigurationService,
        private uiService: UIService,
        private storage: SessionStorageService,
        private network: RestNetworkService,
        private temporaryStorageService: TemporaryStorageService,
    ) {}

    ngOnInit() {
        setTimeout(() => {
            this.tutorialElement = this.mainNavRef.search;
        });
        this.searchService.clear();
        this.initalized = true;
        this.searchService.clear();
        if (this.searchService.reinit) {
            this.searchService.init();
            this.initalized = false;
            this.searchService.showspinner = true;
        }
        this.savedSearchColumns.push(
            new ListItem('NODE', RestConstants.CM_PROP_TITLE),
        );
        this.connector.setRoute(this.activatedRoute).subscribe(() => {
            Translation.initialize(
                this.translate,
                this.config,
                this.storage,
                this.activatedRoute,
            ).subscribe(() => {
                UIHelper.setTitle(
                    'SEARCH.TITLE',
                    this.title,
                    this.translate,
                    this.config,
                );
                if (this.setSidenavSettings()) {
                    // auto, never, always
                    let sidenavMode = this.config.instant(
                        'searchSidenavMode',
                        'never',
                    );
                    if (sidenavMode === 'never') {
                        this.searchService.sidenavOpened = false;
                    }
                    if (sidenavMode === 'always') {
                        this.searchService.sidenavOpened = true;
                    }
                }
                this.printListener();
                if (this.searchService.viewType == -1) {
                    this.setViewType(
                        this.config.instant(
                            'searchViewType',
                            this.config.instant('searchViewType', 1),
                        ),
                    );
                }
                this.groupResults = this.config.instant(
                    'searchGroupResults',
                    false,
                );

                this.searchService.collectionsColumns = [];
                this.searchService.collectionsColumns.push(
                    new ListItem('NODE', RestConstants.CM_NAME),
                );
                this.searchService.collectionsColumns.push(
                    new ListItem('COLLECTION', 'info'),
                );
                this.searchService.collectionsColumns.push(
                    new ListItem('COLLECTION', 'scope'),
                );
                setInterval(() => this.updateHasMore(), 1000);
                this.connector
                    .hasToolPermission(
                        RestConstants.TOOLPERMISSION_UNCHECKEDCONTENT,
                    )
                    .subscribe(unchecked => {
                        this.network.getRepositories().subscribe(
                            (data: NetworkRepositories) => {
                                this.allRepositories = Helper.deepCopy(
                                    data.repositories,
                                );
                                this.repositories = ConfigurationHelper.filterValidRepositories(
                                    data.repositories,
                                    this.config,
                                    !unchecked,
                                );
                                if (this.repositories.length < 1) {
                                    console.warn(
                                        'After filtering repositories via config, none left. Will use the home repository as default',
                                    );
                                    this.repositories = this.getHomeRepoList();
                                }
                                if (this.repositories.length < 2) {
                                    this.repositoryIds = [
                                        this.repositories.length
                                            ? this.repositories[0].id
                                            : RestConstants.HOME_REPOSITORY,
                                    ];
                                    /*this.repositories = null;*/
                                }
                                this.updateCurrentRepositoryId();
                                if (this.repositories) {
                                    let all = new Repository();
                                    all.id = RestConstants.ALL;
                                    all.title = this.translate.instant(
                                        'SEARCH.REPOSITORY_ALL',
                                    );
                                    all.repositoryType = 'ALL';
                                    this.repositories.splice(0, 0, all);
                                    this.updateRepositoryOrder();
                                }
                                this.initParams();
                            },
                            (error: any) => {
                                console.warn(
                                    'could not fetch repository list. Remote repositories can not be shown. Some features might not work properly. Please check the error and re-configure the repository',
                                );
                                this.repositories = this.getHomeRepoList();
                                this.allRepositories = [];
                                let home: any = {
                                    id: 'local',
                                    isHomeRepo: true,
                                };
                                this.allRepositories.push(home);
                                this.repositoryIds = [];
                                this.initParams();
                            },
                        );
                    });
            });
        });
    }

    ngAfterViewInit() {
        this.scrollTo(this.searchService.offset);
        this.innerWidth = this.winRef.getNativeWindow().innerWidth;
        //this.autocompletesArray = this.autocompletes.toArray();
    }

    ngOnDestroy() {
        if (this.queryParamsSubscription) {
            this.queryParamsSubscription.unsubscribe();
        }
    }

    @HostListener('window:scroll', ['$event'])
    handleScroll(event: Event) {
        this.searchService.offset =
            window.pageYOffset || document.documentElement.scrollTop;
    }

    getValuesForMds() {
        // add the primary search word to the currentValuesAll so that the mds is aware of it
        let values = Helper.deepCopy(this.currentValues);
        if (!values) {
            values = [];
        }
        if (this.searchService.searchTerm) {
            values[RestConstants.PRIMARY_SEARCH_CRITERIA] = [
                this.searchService.searchTerm,
            ];
        }
        return values;
    }

    setRepository(repository: string) {
        this.routeSearch(this.searchService.searchTerm, repository, null, null);
        //this.currentRepository=repository;
        //this.getSearch(null,true);
    }

    applyParameters(props: any = null) {
        this.searchService.reinit = true;
        this.searchService.extendedSearchUsed = true;
        this.currentValues = props;
        this.updateGroupedRepositories();
        this.routeSearchParameters(props);
        if (
            UIHelper.evaluateMediaQuery(
                UIConstants.MEDIA_QUERY_MAX_WIDTH,
                UIConstants.MOBILE_WIDTH,
            )
        ) {
            this.searchService.sidenavOpened = false;
        }
        //this.getSearch(null,true,props);
    }

    downloadNode() {
        window.open(this.renderedNode.downloadUrl);
    }

    updateSelection(selection: Node[]) {
        this.selection = selection;
        this.setFixMobileNav();
    }

    getHomeRepoList() {
        return [{ id: 'local', isHomeRepo: true } as any];
    }

    refresh() {
        this.getSearch(null, true);
    }

    scrollTo(y = 0) {
        this.winRef.getNativeWindow().scrollTo(0, y);
    }

    handleFocus(event: Event) {
        if (this.innerWidth < this.breakpoint) {
            this.scrollTo();
        }
    }

    isMobileHeight() {
        return window.innerHeight < UIConstants.MOBILE_HEIGHT + UIConstants.MOBILE_STAGE * 2;
    }

    isMobileWidth() {
        return window.innerWidth < UIConstants.MOBILE_WIDTH;
    }

    isMdsLoading() {
        return !this.mdsDesktopRef || this.mdsDesktopRef.isLoading;
    }

    canDrop() {
        return false;
    }

    getMoreResults() {
        if (this.searchService.complete == false) {
            //this.searchService.skipcount = this.searchService.searchResult.length;
            this.getSearch();
        }
    }

    onResize() {
        this.innerWidth = this.winRef.getNativeWindow().innerWidth;
        this.setSidenavSettings();
    }

    setSidenavSettings() {
        if (this.addToCollection) {
            this.searchService.sidenavOpened = false;
            return false;
        }
        if (this.searchService.sidenavSet) return false;
        this.searchService.sidenavSet = true;
        if (this.innerWidth < this.breakpoint) {
            this.searchService.sidenavOpened = false;
        } else {
            this.searchService.sidenavOpened = true;
        }
        return true;
    }

    routeSearchParameters(parameters: any) {
        this.routeSearch(
            this.searchService.searchTerm,
            this.currentRepository,
            this.mdsId,
            parameters,
        );
    }

    getMdsValues() {
        if (this.currentRepository === RestConstants.ALL) {
            return {};
        }
        return this.mdsMobileRef ? this.mdsMobileRef.getValues() : this.mdsDesktopRef.getValues();
    }

    routeAndClearSearch(query: any) {
        let parameters: any = null;
        if (this.mdsDesktopRef) {
            parameters = this.getMdsValues();
        }
        if (!query.cleared) {
            this.uiService.hideKeyboardIfMobile();
        }
        this.routeSearch(
            query.query,
            this.currentRepository,
            this.mdsId,
            parameters,
        );
    }

    routeSearch(
        query = this.searchService.searchTerm,
        repository = this.currentRepository,
        mds = this.mdsId,
        parameters: any = this.getMdsValues(),
    ) {
        this.scrollTo();
        this.router.navigate([UIConstants.ROUTER_PREFIX + 'search'], {
            queryParams: {
                addToCollection: this.addToCollection
                    ? this.addToCollection.ref.id
                    : null,
                query: query,
                parameters:
                    parameters && Object.keys(parameters)
                        ? JSON.stringify(parameters)
                        : null,
                repositoryFilter: this.getEnabledRepositories().join(','),
                mds: mds,
                repository: repository,
                mdsExtended: this.mdsExtended,
                sidenav: this.searchService.sidenavOpened,
                materialsSortBy: this.searchService.sort.materialsSortBy,
                materialsSortAscending: this.searchService.sort
                    .materialsSortAscending,
                reurl: this.searchService.reurl,
            },
        });
    }

    getSearch(
        searchString: string = null,
        init = false,
    ) {
        if ((this.isSearching && init) || this.repositoryIds.length == 0) {
            setTimeout(
                () => this.getSearch(searchString, init),
                100,
            );
            return;
        }
        if (this.isSearching && !init) {
            return;
        }
        this.isSearching = true;
        this.searchService.showspinner = true;
        if (searchString == null) searchString = this.searchService.searchTerm;
        if (searchString == null) searchString = '';
        this.searchService.searchTerm = searchString;
        if (init) {
            this.searchService.init();
        } else if (
            this.searchService.searchResult.length >
            SearchComponent.MAX_ITEMS_COUNT
        ) {
            this.searchService.showspinner = false;
            this.isSearching = false;
            return;
        }

        let criterias: any[] = this.getCriterias(this.currentValues, searchString);

        let repos =
            this.currentRepository == RestConstants.ALL
                ? this.repositoryIds
                : [{ id: this.currentRepository, enabled: true }];
        this.searchRepository(repos, criterias, init);

        if (init) {
            this.searchService.searchResultCollections = [];
            if (
                this.isHomeRepository() ||
                this.currentRepository == RestConstants.ALL
            ) {
                this.search
                    .search(
                        this.getCriterias(this.currentValues, searchString, false),
                        [],
                        {
                            sortBy: [
                                RestConstants.CCM_PROP_COLLECTION_PINNED_STATUS,
                                RestConstants.CCM_PROP_COLLECTION_PINNED_ORDER,
                                RestConstants.CM_MODIFIED_DATE,
                            ],
                            sortAscending: [false, true, false],
                        },
                        RestConstants.CONTENT_TYPE_COLLECTIONS,
                        this.currentRepository == RestConstants.ALL
                            ? RestConstants.HOME_REPOSITORY
                            : this.currentRepository,
                        this.mdsId,
                        [],
                        'collections',
                    )
                    .subscribe(
                        (data: NodeList) => {
                            this.searchService.searchResultCollections =
                                data.nodes;
                            this.searchService.resultCount.collections =
                                data.pagination.total;
                            this.checkFail();
                        },
                        (error: any) => {
                            this.toast.error(error);
                        },
                    );
            }
        }
    }

    updateGroupedRepositories() {
        let list = this.repositories.slice(1);
        for (let repo of this.repositoryIds) {
            if (repo.enabled) continue;
            let repoFound = RestNetworkService.getRepositoryById(repo.id, list);
            if (repoFound) list.splice(list.indexOf(repoFound), 1);
        }
        this.groupedRepositories = list;
    }
    render(event: any) {
        const node: Node = event.node;
        if (node.collection) {
            this.switchToCollections(node.ref.id);
            return;
        }

        const useRender=RestNetworkService.isHomeRepo(node.ref.repo, this.allRepositories) ||
                    RestNetworkService.getRepositoryById(node.ref.repo,this.allRepositories).renderingSupported;
        if(!useRender) {
          UIHelper.openUrl(node.content.url,this.connector.getBridgeService(),OPEN_URL_MODE.Blank);
          return;
        }

        this.renderedNode = node;
        const queryParams = {
            repository: RestNetworkService.isFromHomeRepo(
                node,
                this.allRepositories,
            )
                ? null
                : node.ref.repo,
            comments: event.source == 'comments' ? true : null,
        };
        this.router.navigate(
            [UIConstants.ROUTER_PREFIX + 'render', node.ref.id],
            { queryParams: queryParams, state: {
                nodes: this.searchService.searchResult,
                scope: 'search'
                }
            },
        );
    }

    switchToCollections(id = '') {
        UIHelper.getCommonParameters(this.activatedRoute).subscribe(params => {
            params.id = id;
            this.router.navigate([UIConstants.ROUTER_PREFIX + 'collections'], {
                queryParams: params,
            });
        });
    }

    setViewType(type: number) {
        this.searchService.viewType = type;
        this.temporaryStorageService.set('view', type);
        if (this.viewToggle)
            this.viewToggle.icon =
                type == ListTableComponent.VIEW_TYPE_GRID
                    ? 'list'
                    : 'view_module';
    }

    toggleView() {
        if (this.searchService.viewType == ListTableComponent.VIEW_TYPE_LIST) {
            this.setViewType(ListTableComponent.VIEW_TYPE_GRID);
        } else {
            this.setViewType(ListTableComponent.VIEW_TYPE_LIST);
        }
    }

    processSearchResult(data: SearchList, init: boolean) {
        this.searchFail = false;
        if (this.currentRepository == RestConstants.ALL && this.groupResults) {
            this.searchService.searchResultRepositories.push(data.nodes);
        } else {
            this.searchService.searchResult = this.searchService.searchResult.concat(
                data.nodes,
            );
        }
        this.searchService.ignored = data.ignored;
        this.checkFail();
        if (
            data.nodes.length < 1 &&
            this.currentRepository != RestConstants.ALL
        ) {
            this.searchService.showspinner = false;
            this.isSearching = false;
            this.searchService.complete = true;
            return;
        }
        if (init) {
            this.searchService.facettes = data.facettes;
            this.mdsSuggestions = {};
            if (data.facettes) {
                for (let facette of data.facettes) {
                    facette.values = facette.values.slice(0, 5);
                    this.mdsSuggestions[facette.property] = [];
                    const widget = MdsHelper.getWidget(facette.property, null, this.currentMdsSet?.widgets);
                    for (let value of facette.values) {
                        const cap =  widget?.values?.find((v: any) => v.id === value.value);
                        this.mdsSuggestions[facette.property].push({
                            id: value.value,
                            caption: cap ? cap.caption : value.value,
                        });
                    }
                }
            }
            if (this.searchService.facettes && this.searchService.facettes[0]) {
                if (
                    this.searchService.autocompleteData.keyword &&
                    this.searchService.facettes[0].values
                ) {
                    for (
                        let i = 0;
                        i < this.searchService.autocompleteData.keyword.length;
                        i++
                    ) {
                        let index = Helper.indexOfObjectArray(
                            this.searchService.facettes[0].values,
                            'value',
                            this.searchService.autocompleteData.keyword[i]
                                .title,
                        );
                        if (index > -1)
                            this.searchService.facettes[0].values.splice(
                                index,
                                1,
                            );
                    }
                }
                this.searchService.facettes[0].values = this.searchService.facettes[0].values.slice(
                    0,
                    20,
                );
            }
        }
        if (
            this.searchService.searchResult.length == data.pagination.total &&
            this.currentRepository != RestConstants.ALL
        )
            this.searchService.complete = true;
    }

    updateMds() {
        this.currentValues = null;
        this.routeSearch(
            this.searchService.searchTerm,
            this.currentRepository,
            this.mdsId,
            null,
        );
    }

    sortMaterials(sort: any) {
        this.searchService.sort.materialsSortBy = sort.name || sort.sortBy;
        this.searchService.sort.materialsSortAscending =
            sort.ascending || sort.sortAscending;
        this.routeSearch();
    }

    permissionAddToCollection(node: Node) {
        if (node.access.indexOf(RestConstants.ACCESS_CC_PUBLISH) == -1) {
            let button: any = null;
            if (
                node.properties[RestConstants.CCM_PROP_QUESTIONSALLOWED] &&
                node.properties[RestConstants.CCM_PROP_QUESTIONSALLOWED][0] ==
                    'true'
            ) {
                button = {
                    icon: 'message',
                    caption: 'ASK_CC_PUBLISH',
                    click: () => {
                        NodeHelper.askCCPublish(this.translate, node);
                    },
                };
            }
            return { status: false, message: 'NO_CC_PUBLISH', button: button };
        }
        return { status: true };
    }

    isWorkspaceEnabled() {
        return ConfigurationHelper.hasMenuButton(this.config, 'workspace');
    }

    setSavedSearchQuery(query: string) {
        this.savedSearchQuery = query;
        this.loadSavedSearch();
    }

    isHomeRepository() {
        return RestNetworkService.isHomeRepo(
            this.currentRepository,
            this.allRepositories,
        );
    }
    hasMobileMds() {
        return this.searchService.sidenavOpened && this.isMobileWidth() && this.isMobileHeight();
    }
    toggleSidenav() {
        this.searchService.sidenavOpened = !this.searchService.sidenavOpened;
        this.setFixMobileNav();
        // init mobile mds
        if(this.hasMobileMds()) {
            UIHelper.waitForComponent(this, 'mdsMobileRef').subscribe(() => {
                this.mdsMobileRef.loadMds();
            });
        }
        //this.routeSearch();
    }

    private updateHasMore() {
        try {
            this.hasMoreCollections =
                document.getElementById('collections').scrollHeight > 90 + 40;
        } catch (e) {}
    }

    private checkFail() {
        this.searchFail =
            this.searchService.searchResult.length < 1 &&
            this.searchService.searchResultCollections.length < 1;
    }

    private updateSortMds() {
        // when mds is not ready, we can't update just now
        if (this.currentMdsSet == null) return;
        let sort = MdsHelper.getSortInfo(this.currentMdsSet, 'search');
        if (sort && sort.columns && sort.columns.length) {
            this.searchService.sort.materialsColumns = [];
            for (let column of sort.columns) {
                let item = new SortItem('NODE', column.id);
                item.mode = column.mode;
                this.searchService.sort.materialsColumns.push(item);
            }
        } else {
            this.searchService.sort.materialsColumns = null;
        }
        return sort;
    }

    private updateSort() {
        let state = this.currentRepository + ':' + this.mdsId;
        let sort = this.updateSortMds();
        // do not update state if current state is valid (otherwise sort info is lost when comming back from rendering)
        // exception: if there is no state at all, refresh it with the default
        if (
            state == this.searchService.sort.state &&
            !(sort && !this.searchService.sort.materialsSortBy)
        )
            return;
        this.searchService.sort.state = state;
        if (sort) {
            this.searchService.sort.materialsSortBy = sort.default.sortBy;
            this.searchService.sort.materialsSortAscending =
                sort.default.sortAscending;
        }
    }

    private updateColumns() {
        this.searchService.columns = MdsHelper.getColumns(
            this.currentMdsSet,
            'search',
        );
    }

    private importNode(
        nodes: Node[],
        pos = 0,
        errors = false,
        lastData: Node = null,
    ) {
        if (pos >= nodes.length) {
            this.globalProgress = false;
            let additional;
            if (nodes.length == 1 && lastData) {
                additional = {
                    link: {
                        caption: 'SEARCH.NODE_IMPORTED_VIEW',
                        callback: () => {
                            UIHelper.goToWorkspace(
                                this.nodeApi,
                                this.router,
                                this.login,
                                lastData,
                            );
                        },
                    },
                };
            }
            if (!errors)
                this.toast.toast(
                    'SEARCH.NODE_IMPORTED',
                    null,
                    null,
                    null,
                    additional,
                );
            return;
        }
        this.globalProgress = true;
        this.nodeApi
            .importNode(
                nodes[pos].ref.repo,
                nodes[pos].ref.id,
                RestConstants.INBOX,
            )
            .subscribe(
                (data: NodeWrapper) => {
                    this.importNode(nodes, pos + 1, errors, data.node);
                },
                (error: any) => {
                    this.toast.error(error);
                    this.importNode(nodes, pos + 1, true, null);
                },
            );
    }

    private getWorkspaceUrl(node: Node) {
        return (
            UIConstants.ROUTER_PREFIX +
            'workspace/files?root=MY_FILES&id=' +
            node.parent.id +
            '&file=' +
            node.ref.id
        );
    }

    private addToStream(node: Node) {
        let nodes = ActionbarHelperService.getNodes(this.selection, node);
        this.addNodesStream = nodes;
    }

    private printListener() {
        // not working properly
        /*
    let mediaQueryList = window.matchMedia('print');
    mediaQueryList.addListener((mql)=> {
      let lastType=-1;
      if (mql.matches) {
        lastType=this.view;
        this.view=ListTableComponent.VIEW_TYPE_LIST;
      } else if(lastType!=-1) {
        this.view=lastType;
        lastType=-1;
      }
    });
    */
    }

    private addToStore(selection: Node[]) {
        this.globalProgress = true;
        RestHelper.addToStore(selection, this.bridge, this.iam, () => {
            this.globalProgress = false;
            this.updateSelection([]);
            this.mainNavRef.refreshNodeStore();
        });
    }

    onMdsReady(mds: any = null) {
        this.currentMdsSet = mds;
        this.updateColumns();
        this.updateSort();
        if (this.searchService.searchResult.length < 1) {
            this.initalized = true;
            if (!this.currentValues && this.getActiveMds()) {
                this.currentValues = this.getMdsValues();
            }
            if (this.searchService.reinit)
                this.getSearch(
                    this.searchService.searchTerm,
                    true);
        }
        if (this.mainNavRef && !this.bannerInitalized) {
            this.mainNavRef.refreshBanner();
            this.bannerInitalized = true;
        }
        this.searchService.reinit = true;
    }

    private prepare(param: Params) {
        if (this.setSidenavSettings()) {
            // auto, never, always
            let sidenavMode = this.config.instant('searchSidenavMode', 'never');
            if (sidenavMode == 'never') {
                this.searchService.sidenavOpened = false;
            }
            if (sidenavMode == 'always') {
                this.searchService.sidenavOpened = true;
            }
        }
        this.connector.isLoggedIn().subscribe((data: LoginResult) => {
            this.toolPermissions = data.toolPermissions;
            if (data.isValidLogin && data.currentScope != null) {
                RestHelper.goToLogin(this.router, this.config);
                return;
            }
            this.login = data;
            this.isGuest = data.isGuest;
            this.updateMdsActions();
            this.mdsExtended = false;
            this.loadSavedSearch();
            if (param['mdsExtended'])
                this.mdsExtended = param['mdsExtended'] == 'true';
            if (param['materialsSortBy']) {
                // set a valid state first
                this.updateSort();
                this.searchService.sort.materialsSortBy =
                    param['materialsSortBy'];
                this.searchService.sort.materialsSortAscending =
                    param['materialsSortAscending'] == 'true';
            }
            if (param.parameters) {
                this.searchService.extendedSearchUsed = true;
                this.currentValues = JSON.parse(param['parameters']);
            } else if (this.currentValues) {
                this.currentValues = null;
            }
            if (param['savedQuery']) {
                this.nodeApi
                    .getNodeMetadata(param['savedQuery'], [RestConstants.ALL])
                    .subscribe((data: NodeWrapper) => {
                        this.loadSavedSearchNode(data.node);
                    });
            } else {
                this.invalidateMds();
            }
            this.searchService.init();
        });
    }

    private getSourceIcon(repo: Repository) {
        return NodeHelper.getSourceIconRepoPath(repo);
    }

    private getCurrentNode(node: Node) {
        return node ? node : this.selection[0];
    }

    private searchRepository(
        repos: any[],
        criterias: any,
        init: boolean,
        position = 0,
        count = 0,
        tryFrontpage = true
    ) {
        if (position > 0 && position >= repos.length) {
            this.searchService.numberofresults = count;
            this.searchService.showspinner = false;
            this.isSearching = false;
            return;
        }

        let repo = repos[position];
        if (!repo.enabled) {
            this.searchRepository(repos, criterias, init, position + 1, count);
            return;
        }

        // default order: lucene score, modified date
        let sortBy = [
            RestConstants.LUCENE_SCORE,
            RestConstants.CM_MODIFIED_DATE,
        ];
        let sortAscending = [false, false];

        // order set by user and order is not of type score (which would be the default mode)
        if (
            this.searchService.sort.materialsSortBy &&
            this.searchService.sort.materialsSortBy !=
                RestConstants.LUCENE_SCORE
        ) {
            sortBy = [this.searchService.sort.materialsSortBy];
            sortAscending = [this.searchService.sort.materialsSortAscending];
        }
        let mdsId = this.mdsId;
        if (this.currentRepository == RestConstants.ALL) {
            const mdsAllowed = ConfigurationHelper.filterValidMds(
                repo,
                null,
                this.config,
            );
            if (mdsAllowed) {
                mdsId = mdsAllowed[0];
            }
        }
        let properties = [RestConstants.ALL];
        const request = {
            sortBy: sortBy,
            sortAscending: sortAscending,
            count:
                this.currentRepository == RestConstants.ALL &&
                !this.groupResults
                    ? Math.max(
                    5,
                    Math.round(
                        this.connector.numberPerRequest /
                        (this.repositories.length - 1),
                    ),
                    )
                    : null,
            offset: this.searchService.skipcount[position],
            propertyFilter: [properties],
        };
        let facettes;
        try {
            facettes = MdsHelper.getUsedWidgets(this.currentMdsSet, 'search_suggestions').map((w: any) => w.id);
        } catch(e) {
            console.warn('Could not load used facettes from search_suggestions', e);
            facettes = [RestConstants.LOM_PROP_GENERAL_KEYWORD];
        }
        let queryRequest =
        this.search
            .search(
                criterias,
                facettes,
                request,
                RestConstants.CONTENT_TYPE_FILES,
                repo ? repo.id : RestConstants.HOME_REPOSITORY,
                mdsId,
            );
            const useFrontpage = !this.searchService.searchTerm && !this.searchService.extendedSearchUsed && this.isHomeRepository();
            console.log('useFrontpage: ' + useFrontpage, !this.searchService.searchTerm, !this.searchService.extendedSearchUsed, this.isHomeRepository());
            if(useFrontpage && tryFrontpage) {
                queryRequest = this.nodeApi.getChildren(RestConstants.NODES_FRONTPAGE, [RestConstants.ALL], request);
            }
            queryRequest.subscribe(
                (data: SearchList) => {
                    if (!this.searchService.skipcount[position])
                        this.searchService.skipcount[position] = 0;
                    this.searchService.skipcount[position] += data.nodes.length;
                    this.searchService.resultCount.materials =
                        data.pagination.total;
                    this.processSearchResult(data, init);
                    this.searchService.showchosenfilters = true;
                    this.searchRepository(
                        repos,
                        criterias,
                        init,
                        position + 1,
                        count + data.pagination.total,
                    );
                }, error => {
                    if(useFrontpage && tryFrontpage && count === 0){
                        console.warn('Could not fetch frontpage data, will fallback to a regular search', error);
                        this.searchRepository(
                            repos,
                            criterias,
                            init,
                            position,
                            count,
                            false
                        );
                        return;
                    }
                    this.toast.error(error);
                    this.searchRepository(
                        repos,
                        criterias,
                        init,
                        position + 1,
                        count,
                    );
                },
            );
    }

    private getSourceIconPath(path: string) {
        return NodeHelper.getSourceIconPath(path);
    }

    private updateRepositoryOrder() {
        if (!this.repositories) return;
        if (this.repositories.length > 4) {
            let hit = false;
            for (let i = 3; i < this.repositories.length; i++) {
                if (this.currentRepository == this.repositories[i].id) {
                    Helper.arraySwap(this.repositories, i, 3);
                    this.extendedRepositorySelected = true;
                    break;
                }
            }
        }
        if (this.repositoryIds.length == 0) {
            this.repositoryIds = [];
            for (let repo of this.repositories) {
                if (repo.id == RestConstants.ALL || repo.id == 'MORE') continue;
                this.repositoryIds.push({
                    id: repo.id,
                    title: repo.title,
                    enabled: this.enabledRepositories
                        ? this.enabledRepositories.indexOf(repo.id) != -1
                        : true,
                });
            }
            this.updateGroupedRepositories();
        }
    }
    private getActiveMds() {
        return this.hasMobileMds() ? this.mdsMobileRef : this.mdsDesktopRef;
    }
    private updateMdsActions() {
        this.savedSearchOptions.addOptions = [];

        this.mdsActions = [];
        this.mdsActions.push(
            new OptionItem('SEARCH.APPLY_FILTER', 'search', () => {
                this.applyParameters(this.getActiveMds().saveValues());
            }),
        );
        if (this.applyMode) {
            let apply = new OptionItem('APPLY', 'redo', (node: Node) => {
                NodeHelper.addNodeToLms(
                    this.router,
                    this.temporaryStorageService,
                    node,
                    this.searchService.reurl,
                );
            });
            this.savedSearchOptions.addOptions.push(apply);
        } else {
        }
        let save = new OptionItem(
            this.applyMode
                ? 'SEARCH.EMBED_SEARCH_ACTION'
                : 'SEARCH.SAVE_SEARCH_ACTION',
            this.applyMode ? 'redo' : 'save',
            () => {
                this.saveSearchDialog = true;
            },
        );
        if (!this.isGuest) {
            this.mdsActions.push(save);
        }
        this.mdsButtons = DialogButton.fromOptionItem(this.mdsActions).slice(
            0,
            1,
        );
    }

    private closeSaveSearchDialog() {
        this.saveSearchDialog = false;
    }

    private saveSearch(name: string, replace = false) {
        this.search
            .saveSearch(
                name,
                this.queryId,
                this.getCriterias(),
                this.currentRepository,
                this.mdsId,
                replace,
            )
            .subscribe(
                (data: NodeWrapper) => {
                    this.saveSearchDialog = false;
                    this.toast.toast('SEARCH.SAVE_SEARCH.TOAST_SAVED');
                    this.loadSavedSearch();
                    if (this.applyMode) {
                        NodeHelper.addNodeToLms(
                            this.router,
                            this.temporaryStorageService,
                            data.node,
                            this.searchService.reurl,
                        );
                    }
                },
                (error: any) => {
                    if (
                        error.status === RestConstants.DUPLICATE_NODE_RESPONSE
                    ) {
                        this.toast.showConfigurableDialog({
                            title: 'SEARCH.SAVE_SEARCH.SEARCH_EXISTS_TITLE',
                            message: 'SEARCH.SAVE_SEARCH.SEARCH_EXISTS_MESSAGE',
                            buttons: [
                                new DialogButton(
                                    'RENAME',
                                    DialogButton.TYPE_CANCEL,
                                    () => this.toast.closeModalDialog(),
                                ),
                                new DialogButton(
                                    'REPLACE',
                                    DialogButton.TYPE_PRIMARY,
                                    () => {
                                        this.toast.closeModalDialog();
                                        this.saveSearch(name, true);
                                    },
                                ),
                            ],
                            isCancelable: true,
                        });
                    } else {
                        this.toast.error(error);
                    }
                },
            );
    }

    private getCriterias(
        properties = this.currentValues,
        searchString = this.searchService.searchTerm,
        addAll = true,
    ) {
        let criterias: any = [];
        if (searchString)
            criterias.push({
                property: RestConstants.PRIMARY_SEARCH_CRITERIA,
                values: [searchString],
            });
        if (!addAll) return criterias;
        if (properties) {
            criterias = criterias.concat(
                RestSearchService.convertCritierias(
                    properties,
                    this.getActiveMds().currentWidgets,
                ),
            );
        }
        return criterias;
    }

    private loadSavedSearchNode(node: Node) {
        this.sidenavTab = 0;
        UIHelper.routeToSearchNode(this.router, this.searchService.reurl, node);
        this.currentSavedSearch = node;
    }

    private goToSaveSearchWorkspace() {
        this.nodeApi
            .getNodeMetadata(RestConstants.SAVED_SEARCH)
            .subscribe((data: NodeWrapper) => {
                UIHelper.goToWorkspaceFolder(
                    this.nodeApi,
                    this.router,
                    this.login,
                    data.node.ref.id,
                );
            });
    }

    private loadSavedSearch() {
        if (!this.isGuest) {
            this.savedSearch = [];
            this.savedSearchLoading = true;
            let request: any = {
                propertyFilter: [RestConstants.ALL],
                sortBy: [RestConstants.CM_PROP_TITLE],
                sortAscending: true,
                offset: 0,
            };
            if (this.savedSearchOwn) {
                request.count = RestConstants.COUNT_UNLIMITED;
                this.nodeApi
                    .getChildren(RestConstants.SAVED_SEARCH, [], request)
                    .subscribe((data: NodeList) => {
                        data.nodes = data.nodes.filter(
                            node =>
                                node.type ==
                                RestConstants.CCM_TYPE_SAVED_SEARCH,
                        );
                        this.savedSearch = data.nodes;
                        this.savedSearchLoading = false;
                    });
            } else {
                this.search
                    .searchSimple(
                        'saved_search',
                        [],
                        this.savedSearchQuery,
                        request,
                        RestConstants.CONTENT_TYPE_ALL,
                    )
                    .subscribe((data: NodeList) => {
                        this.savedSearch = data.nodes;
                        this.savedSearchLoading = false;
                    });
            }
        }
    }

    private invalidateMds() {
        if (this.currentRepository == RestConstants.ALL) {
            this.onMdsReady();
        } else {
            this.getActiveMds().loadMds();
        }
    }

    private initParams() {
        this.queryParamsSubscription = this.activatedRoute.queryParams.subscribe(
            (param) => {
                if(this.oldParams) {
                    // check if reinit can be skipped (e.g. if only view relevant params changed)
                    let reinit = false;
                    for (const key of Object.keys(param || {}).concat(Object.keys(this.oldParams))) {
                        if (this.oldParams[key] === param[key]) {
                            continue;
                        }
                        if (key === UIConstants.QUERY_PARAM_LIST_VIEW_TYPE) {
                            continue;
                        }
                        reinit = true;
                    }
                    this.oldParams = param;
                    if (!reinit) {
                        return;
                    }
                } else {
                    this.oldParams = param;
                }

                this.searchService.init();
                this.mainNavRef.refreshBanner();
                GlobalContainerComponent.finishPreloading();
                this.hasCheckbox = true;
                this.searchService.reurl = null;
                if (param.viewType != null) {
                    this.setViewType(param.viewType);
                }
                if (param.addToCollection) {
                    this.collectionApi
                        .getCollection(param.addToCollection)
                        .subscribe(
                            (data: CollectionWrapper) => {
                                this.addToCollection = data.collection;
                                // add to collection layout is only designed for GRIDS, otherwise missing permission info will fail
                                this.setViewType(
                                    ListTableComponent.VIEW_TYPE_GRID,
                                );
                                this.customOptions = {
                                    useDefaultOptions: false,
                                    addOptions: [
                                        new OptionItem('SEARCH.ADD_INTO_COLLECTION_SHORT','layers', (node) => {
                                            this.mainNavRef.management.addToCollectionList(this.addToCollection, ActionbarHelperService.getNodes(this.selection,node), true, () => {
                                                this.switchToCollections(this.addToCollection.ref.id);
                                            });
                                        })
                                    ]
                                };
                            },
                            error => {
                                this.toast.error(error);
                            },
                        );
                } else if (param.reurl) {
                    this.searchService.reurl = param.reurl;
                    this.applyMode = true;
                    this.hasCheckbox = false;
                } else if (param.savedSearch) {
                    this.nodeApi
                        .getNodeMetadata(param.savedSearch, [RestConstants.ALL])
                        .subscribe(node => {
                            this.loadSavedSearchNode(node.node);
                        });
                    return;
                }
                this.mainnav = param.mainnav !== 'false';
                if (param.sidenav) {
                    this.searchService.sidenavOpened =
                        param.sidenav !== 'false';
                }
                if (param.query) {
                    this.searchService.searchTerm = param.query;
                }
                if (param.repositoryFilter) {
                    this.enabledRepositories = param['repositoryFilter'].split(
                        ',',
                    );
                    // do a reload of the repos
                    this.repositoryIds = [];
                }

                let paramRepo = param.repository;
                if (!paramRepo) {
                    paramRepo = RestConstants.HOME_REPOSITORY;
                }
                let previousRepository = this.currentRepository;
                this.mdsSets = null;
                if (this.currentRepository != paramRepo) {
                    this.mdsId = RestConstants.DEFAULT;
                }
                this.currentRepository = paramRepo;
                this.updateRepositoryOrder();
                this.updateCurrentRepositoryId();
                if (
                    this.config.instant('availableRepositories') &&
                    this.repositories.length &&
                    this.currentRepository != RestConstants.ALL &&
                    RestNetworkService.getRepositoryById(
                        this.currentRepository,
                        this.repositories,
                    ) == null
                ) {
                    let use = this.config.instant('availableRepositories');
                    console.info(
                        'current repository ' +
                            this.currentRepository +
                            ' is restricted by context, switching to primary ' +
                            use,
                    );
                    this.routeSearch(
                        this.searchService.searchTerm,
                        use,
                        RestConstants.DEFAULT,
                    );
                }
                if (this.currentRepository != previousRepository) {
                    this.currentValues = null;
                }
                this.updateSelection([]);
                let repo = this.currentRepository;
                this.mdsService.getSets(repo).subscribe(
                    (data: MdsMetadatasets) => {
                        if (repo != this.currentRepository) {
                            return;
                        }
                        this.mdsSets = ConfigurationHelper.filterValidMds(
                            this.currentRepositoryObject
                                ? this.currentRepositoryObject
                                : this.currentRepository,
                            data.metadatasets,
                            this.config,
                        );
                        if (this.mdsSets) {
                            UIHelper.prepareMetadatasets(
                                this.translate,
                                this.mdsSets,
                            );
                            try {
                                this.mdsId = this.mdsSets[0].id;
                                if (
                                    param.mds &&
                                    Helper.indexOfObjectArray(
                                        this.mdsSets,
                                        'id',
                                        param.mds,
                                    ) != -1
                                )
                                    this.mdsId = param.mds;
                            } catch (e) {
                                console.warn(
                                    'got invalid mds list from repository:',
                                );
                                console.warn(this.mdsSets);
                                console.warn('will continue with default mds');
                                this.mdsId = RestConstants.DEFAULT;
                            }
                            this.prepare(param);
                        }
                    },
                    (error: any) => {
                        this.mdsId = RestConstants.DEFAULT;
                        this.prepare(param);
                    },
                );
            },
        );
    }

    private updateCurrentRepositoryId() {
        this.currentRepositoryObject = RestNetworkService.getRepositoryById(
            this.currentRepository,
            this.allRepositories,
        );
        if (
            this.currentRepository == RestConstants.HOME_REPOSITORY &&
            this.currentRepositoryObject
        ) {
            this.currentRepository = this.currentRepositoryObject.id;
        }
    }

    private getEnabledRepositories() {
        if (this.repositoryIds && this.repositoryIds.length) {
            let result = [];
            for (let repo of this.repositoryIds) {
                if (repo.enabled) result.push(repo.id);
            }
            return result;
        }
        return null;
    }

    private setFixMobileNav() {
        this.mainNavRef.setFixMobileElements(
            this.searchService.sidenavOpened ||
                (this.selection && this.selection.length > 0),
        );
    }
}
