$(function() {

  let $createContactForm = $('#create-contact-form');
  let $editContactForm = $('#edit-contact-form');
  let $filterTagsList = $('.filter-tags-list');
  let $contacts = $('.contacts');
  let $main = $('main');

  let $contact = $('#contact-template');
  let $contactLayout = $('#contact-layout');
  let contactLayoutTemplate = Handlebars.compile($contactLayout.html());
  let contactTemplate = Handlebars.compile($contact.html());
  Handlebars.registerPartial('contactTemplate', $contact.html());

  const validationTable = {
    full_name(input) {
      if (input.trim() === '') {
        return 'Full name is a required field';
      } else {
        return '';
      }
    },
    email(input) {
      if (input.match(/^\w+@.+\.\w+$/)) {
        return '';
      } else {
        return 'Please enter a valid email';
      }
    },
    phone_number(input) {
      if (input.match(/^\d+$/) &&
      (input.length === 10 || input.length === 11)) {
        return '';
      } else {
        return 'Please enter a valid phone number';
      }
    },
    tags(input) {
      if (input.trim() === '') {
        return '';
      }
      let tagsArr = input.split(',').map(tag => tag.trim());
      let currentTags = {};
      for (let idx = 0; idx < tagsArr.length; idx++) {
        let tag = tagsArr[idx];
        if (tag.length > 0 && !currentTags[tag]) {
          currentTags[tag] = true;
        } else {
          return 'Tags may not be empty or be duplicated!';
        }
      }
      return '';
    }
  };

  function convertToJson(formData) {
    let json = {};
    formData = [...formData];
    formData.forEach(pair => {
      json[pair[0]] = pair[1];
    });
    return JSON.stringify(json);
  }

  class Contact {
    constructor(contactInfo) {
      this.update(contactInfo);
    }

    update(contactInfo) {
      this.id = contactInfo.id;
      this.full_name = contactInfo.full_name;
      this.email = contactInfo.email;
      this.phone_number = contactInfo.phone_number;
      this.tags = contactInfo.tags;
      this.tagsArr = this.separateTags(contactInfo);
    }

    delete() {
      this.getComponent().remove();
    }

    separateTags(contact) {
      if (contact.tags) {
        return contact.tags.split(',').map(tag => tag.trim());
      } else {
        return null;
      }
    }

    getComponent() {
      return $(`#${this.id}`);
    }
  }

  class ContactStore {
    constructor(app, contacts) {

      this.app = app;
      this.contacts = [];
      contacts.forEach(contactInfo => {
        let contact = new Contact(contactInfo);
        this.contacts.push(contact);
      });
    }

    createContact(contactInfo) {
      let contact = new Contact(contactInfo);
      this.contacts.push(contact);

      this.renderNewContact(contactInfo);
      return contact;
    }

    getContactById(id) {
      let contacts = this.contacts;
      for (let index = 0; index < contacts.length; index++) {
        let contact = contacts[index];
        if (contact.id === Number(id)) {
          return {contact, index};
        }
      }
      return null;
    }

    updateContact(contactInfo) {
      let {contact} = this.getContactById(contactInfo.id);
      contact.update(contactInfo);
      this.rerenderContact(contact);
    }

    deleteContact(id) {
      let {contact, index} = this.getContactById(id);
      contact.delete();
      this.contacts.splice(index, 1);
    }

    renderNewContact(contactInfo) {
      let renderedContact = contactTemplate(contactInfo);
      $('.contacts-list').append(renderedContact);
    }

    rerenderContact(contact) {
      let $currentContact = contact.getComponent();
      let $newContact = $(contactTemplate(contact));
      $newContact.insertAfter($currentContact);
      $currentContact.remove();
    }

    renderContacts() {
      let $contacts = $('.contacts');
      $contacts.innerHTML = '';
      let contactLayout = contactLayoutTemplate(this.contacts);
      $contacts.html(contactLayout);
      this.displayFilteredContacts();
    }

    displayFilteredContacts() {
      let filteredContacts = this.getMatchingContactsBySearch(this.contacts);
      filteredContacts = this.getMatchingContactsByTag(filteredContacts);
      this.contacts.forEach(contact => {
        if (filteredContacts.indexOf(contact) > -1) {
          contact.getComponent().show();
        } else {
          contact.getComponent().hide();
        }
      });
    }

    getMatchingContactsBySearch(contacts) {
      let matchingContacts = [];
      let searchText = $('.search').val().toLowerCase();
      if (searchText === '') {
        matchingContacts = contacts;
      } else {
        contacts.forEach(contact => {
          let name = contact.full_name.toLowerCase();
          if (name.indexOf(searchText) > -1) {
            matchingContacts.push(contact);
          }
        });
      }
      return matchingContacts;
    }

    getMatchingContactsByTag(contacts) {
      let matchingContacts = [];
      let filterTags = this.app.filterTags;
      if (filterTags.length === 0) {
        matchingContacts = contacts;
      } else {
        contacts.forEach(contact => {
          let tags = contact.tags;
          if (tags &&
             filterTags.every(filterTag => tags.indexOf(filterTag) > -1)) {
            matchingContacts.push(contact);
          }
        });
      }
      return matchingContacts;
    }
  }

  class App {
    constructor() {
      this.cleanDom();
      this.bindEvents();

      $.get('/api/contacts', contacts => {
        this.currentEditContactId = null;
        this.filterTags = [];
        this.searchTimeout = null;
        this.contactStore = new ContactStore(this, contacts);
        this.contactStore.renderContacts();
      });
    }

    cleanDom() {
      $contact.remove();
      $contactLayout.remove();
      $editContactForm.hide();
      $createContactForm.hide();
    }

    bindEvents() {
      $('#create-contact').on('click', this.renderCreateForm.bind(this));
      $('.search').on('keyup', this.filterContacts.bind(this));
      $contacts.on('click', this.onContactClick.bind(this));
      $createContactForm.find('input[type=button]').on('click', this.onCreateFormCancel.bind(this));
      $editContactForm.find('input[type=button]').on('click', this.onEditFormCancel.bind(this));
      $createContactForm.on('submit', this.onCreateFormSubmit.bind(this));
      $editContactForm.on('submit', this.onEditFormSubmit.bind(this));
    }

    renderCreateForm(event) {
      event.preventDefault();
      $createContactForm.show();
      $main.hide();
    }

    filterContacts(event) {
      event.preventDefault();
      clearTimeout(this.timeout);
      let contactStore = this.contactStore;
      this.timeout = setTimeout(
        contactStore.displayFilteredContacts.bind(contactStore),
        200);
    }

    onContactClick(event) {
      event.preventDefault();
      let $target = $(event.target);

      if ($target.hasClass('edit')) {
        let id = $target.closest('li').attr('id');
        this.renderEditForm(id);
      } else if ($target.hasClass('delete')) {
        let id = $target.closest('.contact').attr('id');
        let response = confirm("Do you want to delete the contact?");
        if (!response) {
          return;
        }
        this.deleteContact(id);
      } else if ($target.hasClass('tag')) {
        this.addFilterTag($(event.target).text());
      }
    }

    renderEditForm(id) {
      $editContactForm.show();
      $main.hide();
      this.currentEditContactId = id;
      let {contact} = this.contactStore.getContactById(id);
      for (let prop in contact) {
        let $input = $editContactForm.find(`[name="${prop}"]`);
        $input.val(contact[prop]);
      }
    }

    addFilterTag(tag) {
      if (this.filterTags.indexOf(tag) > -1) {
        return;
      }
      this.filterTags.push(tag);
      let $li = $('<li></li>').text(tag).addClass('filter-tag');
      $li.on('click', () => {
        this.removeFilterTag(tag, $li);
      });
      $filterTagsList.append($li);
      this.contactStore.displayFilteredContacts();
    }

    removeFilterTag(tag, $li) {
      $li.remove();
      let filterTags = this.filterTags;
      filterTags.splice(filterTags.indexOf(tag), 1);
      this.contactStore.displayFilteredContacts();
    }

    onEditFormCancel(event) {
      $editContactForm.hide();
      $main.show();
      let $form = $(event.target).closest('form');
      this.hideAllErrors($form);
    }

    onCreateFormCancel(event) {
      $createContactForm.hide();
      $main.show();
      let $form = $(event.target).closest('form');
      this.hideAllErrors($form);
    }

    displayError($form, name, errorMessage) {
      let $input = $form.find(`[name="${name}"]`);
      $input.next().text(errorMessage);
      $input.addClass('input-error');
      $input.parent().prev().addClass('label-error');
    }

    hideError($form, name) {
      let $input = $form.find(`[name="${name}"]`);
      $input.next().text('');
      $input.removeClass('input-error');
      $input.parent().prev().removeClass('label-error');
    }

    hideAllErrors($form) {
      $form.find('.input-error').removeClass('input-error');
      $form.find('.label-error').removeClass('label-error');
      $form.find('.invalid').text('');
    }

    onCreateFormSubmit(event) {
      event.preventDefault();
      let $form = $(event.target);
      let formData = new FormData($form[0]);
      let formValid = this.validateForm($form, formData);
      if (formValid) {
        let json = convertToJson(formData);
        this.createContact(json);
      }
    }

    onEditFormSubmit(event) {
      event.preventDefault();
      let $form = $(event.target);
      let formData = new FormData($form[0]);
      let formValid = this.validateForm($form, formData);
      if (formValid) {
        let json = convertToJson(formData);
        this.updateContact(json);
      }
    }

    validateForm($form, formData) {
      let pairs = [...formData];
      let valid = true;
      pairs.forEach(pair => {
        let inputName = pair[0];
        let inputValue = pair[1];
        let validationResult = validationTable[inputName](inputValue);
        if (validationResult === '') {
          this.hideError($form, inputName);
        } else {
          valid = false;
          this.displayError($form, inputName, validationResult);
        }
      });
      return valid;
    }

    createContact(json) {
      let self = this;
      $.ajax({
        method: 'POST',
        url: '/api/contacts',
        data: json,
        contentType: 'application/json',
        success(contactInfo) {
          self.onContactCreated(contactInfo);
        }
      });
    }

    onContactCreated(contactInfo) {
      this.contactStore.createContact(contactInfo);
      $createContactForm.hide();
      $main.show();
    }

    updateContact(json) {
      let self = this;
      $.ajax({
        method: 'PUT',
        url: `/api/contacts/${this.currentEditContactId}`,
        data: json,
        contentType: 'application/json',
        success(contactInfo) {
          self.onContactUpdated(contactInfo);
        }
      });
    }

    onContactUpdated(contactInfo) {
      this.contactStore.updateContact(contactInfo);
      $editContactForm.hide();
      $main.show();
    }

    deleteContact(id) {
      let self = this;
      $.ajax({
        url: `/api/contacts/${id}`,
        type: 'DELETE',
        success: function() {
          self.onContactDeleted(id);
        }
      });
    }

    onContactDeleted(id) {
      this.contactStore.deleteContact(id);
    }
  }

  (() => new App())();
});