import {Component, ElementRef, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete/autocomplete';
import { forkJoin, Observable, of } from 'rxjs';
import {catchError, debounceTime, map, startWith, switchMap} from 'rxjs/operators';
import {
    Authority,
    AuthorityProfile,
    Group, GroupProfile, RestConnectorService,
    RestConstants,
    RestIamService,
    RestOrganizationService, User,
} from '../../../core-module/core.module';
import {NodeHelperService} from '../../../core-ui-module/node-helper.service';
import { PermissionNamePipe } from '../../../core-ui-module/pipes/permission-name.pipe';
import { SuggestItem } from '../autocomplete/autocomplete.component';

interface SuggestionGroup {
    label: string,
    values: SuggestItem[],
}

@Component({
    selector: 'authority-search-input',
    templateUrl: 'authority-search-input.component.html',
    styleUrls: ['authority-search-input.component.scss'],
})
export class AuthoritySearchInputComponent {
    @ViewChild('inputElement') inputElement: ElementRef<HTMLInputElement>;

    @Input() globalSearchAllowed = false;
    /**
     * Do allow any entered authority (not recommended for general use)
     */
    @Input() allowAny = false;
    /**
     * Group type to filter the groups searched for
     */
    @Input() groupType = '';
    /**
     * maximum number of authorities to fetch in total
     */
    @Input() authorityCount = 50;
    /**
     * Show recent invited users
     */
    @Input() showRecent = true;
    @Input() mode = AuthoritySearchMode.UsersAndGroups;
    @Input() set disabled(disabled: boolean){
        disabled ? this.input.disable() : this.input.enable();
    }
    @Input() maxSuggestions = 10;
    @Input() inputIcon = 'search';
    /**
     * label, if unset, placeholder will be used
     */
    @Input() label: string;
    @Input() placeholder = 'WORKSPACE.INVITE_FIELD';
    @Input() hint = '';

    @Output() onChooseAuthority = new EventEmitter<Authority|any>();

    input = new FormControl('');
    suggestionGroups$: Observable<SuggestionGroup[]>;

    constructor(
        private iam: RestIamService,
        private organization: RestOrganizationService,
        private restConnector: RestConnectorService,
        private namePipe: PermissionNamePipe,
        private nodeHelper: NodeHelperService,
    ) {
        this.suggestionGroups$ = this.input.valueChanges.pipe(
            startWith(''),
            debounceTime(200),
            switchMap((value) => this.getSuggestions(value)),
        );
    }

    addSuggestion(data: any) {
        this.onChooseAuthority.emit(data.originalObject);
    }

    addAny(data: string) {
        const authority = new Authority();
        authority.authorityName = data;
        authority.authorityType = RestConstants.AUTHORITY_TYPE_UNKNOWN;
        this.onChooseAuthority.emit(authority);
    }

    onSubmit() {
        if (this.allowAny) {
            this.addAny(this.input.value);
        }
    }

    setOption(event: MatAutocompleteSelectedEvent) {
        this.addSuggestion(event.option.value);
        this.input.setValue('');
    }

    getSuggestions(inputValue: string): Observable<SuggestionGroup[]> {
        if (inputValue.length < 2) {
            if (this.showRecent && this.restConnector.getCurrentLogin()?.currentScope == null) {
                return this.getRecentSuggestions();
            } else {
                return of(null);
            }
        } else {
            switch (this.mode) {
                case AuthoritySearchMode.Users:
                    return this.getUsersSuggestions(inputValue);
                case AuthoritySearchMode.UsersAndGroups:
                    return this.getUsersAndGroupsSuggestions(inputValue);
                case AuthoritySearchMode.Organizations:
                    return this.getOrganizationsSuggestions(inputValue);
            }
        }
    }

    private getRecentSuggestions(): Observable<SuggestionGroup[]> {
        return this.iam.getRecentlyInvited().pipe(
            map(({ authorities }) => [
                {
                    label: 'WORKSPACE.INVITE_RECENT_AUTHORITIES',
                    values: this.convertData(authorities),
                },
            ]),
        );
    }

    private getUsersAndGroupsSuggestions(inputValue: string): Observable<SuggestionGroup[]> {
        const observables: Observable<SuggestionGroup>[] = [];
        observables.push(
            this.iam.searchAuthorities(inputValue, false, this.groupType, '', {
                count: 50,
            }).pipe(
                map(({ authorities }) => ({
                    label: 'WORKSPACE.INVITE_LOCAL_RESULTS',
                    values: this.convertData(authorities),
                })),
            ),
        );
        if (this.globalSearchAllowed) {
            observables.push(
                this.iam.searchAuthorities(inputValue, true, this.groupType, '', {
                    count: 100,
                }).pipe(
                    map(({ authorities }) => ({
                        label: 'WORKSPACE.INVITE_GLOBAL_RESULTS',
                        values: this.convertData(authorities),
                    })),
                    catchError(err => of({
                        values: []
                    } as SuggestionGroup)),
                ),
            );
        }
        return forkJoin(observables).pipe(
            // Filter double entries from global results
            map((suggestionGroups) => {
                if (suggestionGroups.length === 2) {
                    suggestionGroups[1].values = suggestionGroups[1].values.filter(
                        (globalSuggestion) =>
                            suggestionGroups[0].values.every(
                                (localSuggestion) => localSuggestion.id !== globalSuggestion.id,
                            ),
                    );
                }
                return suggestionGroups;
            }),
            // Filter empty lists
            map((suggestionGroups) => suggestionGroups.filter((group) => group.values.length > 0)),
        );
    }
    private getUsersSuggestions(inputValue: string): Observable<SuggestionGroup[]> {
        const observables: Observable<SuggestionGroup>[] = [];
        observables.push(
            this.iam.searchUsers(inputValue, false).pipe(
                map(({ users }) => ({
                    label: 'WORKSPACE.INVITE_LOCAL_RESULTS',
                    values: this.convertData(users),
                })),
            ),
        );
        if (this.globalSearchAllowed) {
            observables.push(
                this.iam.searchUsers(inputValue, true).pipe(
                    map(({ users }) => ({
                        label: 'WORKSPACE.INVITE_GLOBAL_RESULTS',
                        values: this.convertData(users),
                    })),
                ),
            );
        }
        return forkJoin(observables).pipe(
            // Filter double entries from global results
            map((suggestionGroups) => {
                if (suggestionGroups.length === 2) {
                    suggestionGroups[1].values = suggestionGroups[1].values.filter(
                        (globalSuggestion) =>
                            suggestionGroups[0].values.every(
                                (localSuggestion) => localSuggestion.id !== globalSuggestion.id,
                            ),
                    );
                }
                return suggestionGroups;
            }),
            // Filter empty lists
            map((suggestionGroups) => suggestionGroups.filter((group) => group.values.length > 0)),
        );
    }
    private getOrganizationsSuggestions(inputValue: string): Observable<SuggestionGroup[]> {
        const observables: Observable<SuggestionGroup>[] = [];
        observables.push(
            this.organization.getOrganizations(inputValue).pipe(
                map(({ organizations }) => {
                    return {
                        label: 'WORKSPACE.INVITE_LOCAL_RESULTS',
                        values: this.convertData(organizations),
                    }
                }),
            )
        );
        if (this.globalSearchAllowed) {
            observables.push(
                this.organization.getOrganizations(inputValue, false).pipe(
                    map(({ organizations }) => {
                        return {
                            label: 'WORKSPACE.INVITE_GLOBAL_RESULTS',
                            values: this.convertData(organizations),
                        }
                    }),
                )
            );
        }
        return forkJoin(observables).pipe(
            // Filter double entries from global results
            map((suggestionGroups) => {
                if (suggestionGroups.length === 2) {
                    suggestionGroups[1].values = suggestionGroups[1].values.filter(
                        (globalSuggestion) =>
                            suggestionGroups[0].values.every(
                                (localSuggestion) => localSuggestion.id !== globalSuggestion.id,
                            ),
                    );
                }
                return suggestionGroups;
            }),
            // Filter empty lists
            map((suggestionGroups) => suggestionGroups.filter((group) => group.values.length > 0)),
        );
    }

    private convertData(authorities: AuthorityProfile[] | Group[] | User[]): SuggestItem[] {
        const result: SuggestItem[] = [];
        for (const user of authorities) {
            const group = (user.profile as GroupProfile).displayName != null;
            const item = new SuggestItem(
                user.authorityName,
                group
                    ? (user.profile as GroupProfile).displayName
                    : this.nodeHelper.getUserDisplayName(user as AuthorityProfile),
                group ? 'group' : 'person',
                '',
            );
            item.originalObject = user;
            item.secondaryTitle = this.namePipe.transform(user, {
                field: 'secondary',
            });
            result.push(item);
        }
        return result;
    }
}

export enum AuthoritySearchMode {
    Users = 'Users',
    UsersAndGroups = 'UsersAndGroups',
    Organizations = 'Organizations',
}
